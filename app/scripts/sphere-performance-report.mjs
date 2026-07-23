#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const appDirectory = path.resolve(path.dirname(scriptPath), "..");
const defaultExecutable = path.join(
  appDirectory,
  "out",
  "darwin",
  `Relic-darwin-${process.arch}`,
  "Relic.app",
  "Contents",
  "MacOS",
  "Relic"
);
const graphSizes = {
  baseline: { links: 3_000, nodes: 1_512 },
  large: { links: 6_000, nodes: 3_000 },
  medium: { links: 1_500, nodes: 750 },
  small: { links: 500, nodes: 250 }
};
const sphereIntentLeadMs = 250;

export function parseSpherePerformanceArgs(rawArgs) {
  const args = rawArgs.filter((value) => value !== "--");
  const parsed = {
    cycles: 0,
    executable: defaultExecutable,
    output: null,
    runs: 3,
    size: "baseline"
  };

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!value) throw new Error(`Missing value for ${key}.`);
    if (key === "--executable") parsed.executable = path.resolve(value);
    else if (key === "--output") parsed.output = path.resolve(value);
    else if (key === "--cycles") parsed.cycles = nonNegativeInteger(value, "cycles");
    else if (key === "--runs") parsed.runs = positiveInteger(value, "runs");
    else if (key === "--size" && Object.hasOwn(graphSizes, value)) parsed.size = value;
    else throw new Error(`Unknown argument: ${key}`);
    index += 1;
  }

  return parsed;
}

function nonNegativeInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== value) {
    throw new Error(`--${name} must be a non-negative integer.`);
  }
  return parsed;
}

function positiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return parsed;
}

export function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

export function summarize(values) {
  return {
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95)
  };
}

async function createFixture(root, size) {
  const workspacePath = path.join(root, "workspace");
  await mkdir(workspacePath, { recursive: true });
  const outgoing = Array.from({ length: size.nodes }, () => []);
  for (let index = 0; index < size.links; index += 1) {
    const source = index % size.nodes;
    const stride = 1 + (index % 31);
    const target = (source + stride) % size.nodes;
    outgoing[source].push(target);
  }
  await Promise.all(outgoing.map((targets, index) => {
    const name = `note-${String(index).padStart(5, "0")}`;
    const links = targets.map((target) => `[[note-${String(target).padStart(5, "0")}]]`);
    return writeFile(path.join(workspacePath, `${name}.md`), `# ${name}\n\n${links.join("\n")}\n`, "utf8");
  }));

  const userDataPath = path.join(root, "user-data");
  await mkdir(userDataPath, { recursive: true });
  await writeFile(path.join(userDataPath, "app-settings.json"), JSON.stringify({
    featureToggles: { graph: true, sphere: true },
    lastWorkspaceId: "sphere-audit",
    schemaVersion: 4,
    workspaces: [{ id: "sphere-audit", name: "Sphere audit", path: workspacePath }]
  }), "utf8");
  return { userDataPath, workspacePath };
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

async function waitForTargets(port, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const targets = await getJson(`http://127.0.0.1:${port}/json`);
      const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Electron has not opened its debugging endpoint yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Electron debugging endpoint did not become ready.");
}

class CdpClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression, awaitPromise = false) {
  const result = await client.call("Runtime.evaluate", {
    awaitPromise,
    expression,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitForValue(client, expression, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(client, expression);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
}

async function sampleProcessTree(rootPid) {
  const output = await new Promise((resolve, reject) => {
    const child = spawn("ps", ["-axo", "pid=,ppid=,%cpu=,rss="]);
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve(Buffer.concat(chunks).toString("utf8"))
      : reject(new Error(`ps exited with ${code}.`)));
  });
  const rows = output.trim().split("\n").map((line) => {
    const [pid, ppid, cpu, rss] = line.trim().split(/\s+/).map(Number);
    return { cpu, pid, ppid, rss };
  });
  const processIds = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (processIds.has(row.ppid) && !processIds.has(row.pid)) {
        processIds.add(row.pid);
        changed = true;
      }
    }
  }
  const selected = rows.filter((row) => processIds.has(row.pid));
  return {
    cpuPercent: selected.reduce((sum, row) => sum + row.cpu, 0),
    rssBytes: selected.reduce((sum, row) => sum + row.rss * 1024, 0)
  };
}

async function runScenario(executable, fixture, port, cycles) {
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${fixture.userDataPath}`
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  let client;
  try {
    process.stderr.write(`[sphere-performance] Waiting for Electron on port ${port}.\n`);
    const target = await waitForTargets(port);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.open();
    await client.call("Runtime.enable");
    await client.call("Performance.enable");
    await waitForValue(client, "document.readyState === 'complete'");
    process.stderr.write("[sphere-performance] Renderer ready; opening Sphere.\n");
    await evaluate(client, `(() => {
      const original = window.requestAnimationFrame.bind(window);
      window.__sphereAuditOriginalRaf = original;
      window.__sphereAuditFrames = [];
      window.requestAnimationFrame = (callback) => original((time) => {
        window.__sphereAuditFrames.push(time);
        callback(time);
      });
      return true;
    })()`);
    const environment = await evaluate(client, `({
      devicePixelRatio: window.devicePixelRatio,
      height: window.innerHeight,
      width: window.innerWidth
    })`);
    const before = metricMap(await client.call("Performance.getMetrics"));
    await waitForValue(client, `([...document.querySelectorAll('button')].some((candidate) => {
      const label = ((candidate.textContent ?? '') + ' ' + (candidate.getAttribute('aria-label') ?? '')).trim();
      return /スフィア|Sphere/i.test(label);
    }))`);
    const sphereButtonCenter = await evaluate(client, `(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) => {
        const label = ((candidate.textContent ?? '') + ' ' + (candidate.getAttribute('aria-label') ?? '')).trim();
        return /スフィア|Sphere/i.test(label);
      });
      const rect = button.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await client.call("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: sphereButtonCenter.x,
      y: sphereButtonCenter.y
    });
    await new Promise((resolve) => setTimeout(resolve, sphereIntentLeadMs));
    const openedAt = await evaluate(client, `(() => {
      const button = [...document.querySelectorAll('button')]
        .find((candidate) => {
          const label = ((candidate.textContent ?? '') + ' ' + (candidate.getAttribute('aria-label') ?? '')).trim();
          return /スフィア|Sphere/i.test(label);
        });
      if (!button) return 0;
      const now = performance.now();
      button.click();
      return now;
    })()`);
    if (!openedAt) throw new Error("Sphere navigation button was not found.");
    const readyAt = await waitForValue(client, `(() => {
      const canvas = document.querySelector('.sphere-view-canvas canvas');
      const status = document.querySelector('.chart-view-status');
      return canvas && !status ? performance.now() : 0;
    })()`, 60_000);
    process.stderr.write("[sphere-performance] Sphere ready; waiting for layout warmup.\n");
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await evaluate(client, "window.__sphereAuditFrames.length = 0");
    const interactionStart = await evaluate(client, "performance.now()");
    const bounds = await evaluate(client, `(() => {
      const rect = document.querySelector('.sphere-view-canvas canvas').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()`);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    await client.call("Input.dispatchMouseEvent", { button: "left", buttons: 1, clickCount: 1, type: "mousePressed", x: centerX, y: centerY });
    for (let index = 0; index < 120; index += 1) {
      await client.call("Input.dispatchMouseEvent", {
        button: "left",
        buttons: 1,
        type: "mouseMoved",
        x: centerX + Math.sin(index / 12) * bounds.width * 0.18,
        y: centerY + Math.cos(index / 15) * bounds.height * 0.12
      });
      if (index % 12 === 0) {
        await client.call("Input.dispatchMouseEvent", { deltaX: 0, deltaY: index % 24 === 0 ? -28 : 28, type: "mouseWheel", x: centerX, y: centerY });
      }
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    await client.call("Input.dispatchMouseEvent", { button: "left", buttons: 0, clickCount: 1, type: "mouseReleased", x: centerX, y: centerY });
    const interactionEnd = await evaluate(client, "performance.now()");
    const interactionFrames = await evaluate(client, "window.__sphereAuditFrames.slice()");
    const interactionFrameTimes = interactionFrames.slice(1).map((value, index) => value - interactionFrames[index]);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await evaluate(client, "window.__sphereAuditFrames.length = 0");
    const idleMetricsBefore = metricMap(await client.call("Performance.getMetrics"));
    const idleProcessBefore = await sampleProcessTree(child.pid);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    const idleProcessAfter = await sampleProcessTree(child.pid);
    const idleMetricsAfter = metricMap(await client.call("Performance.getMetrics"));
    const idleFrames = await evaluate(client, "window.__sphereAuditFrames.length");
    let lifecycle = null;
    if (cycles > 0) {
      await evaluate(client, `(() => {
        window.requestAnimationFrame = window.__sphereAuditOriginalRaf;
        window.__sphereAuditFrames.length = 0;
        return true;
      })()`);
      await client.call("HeapProfiler.enable");
      const closeSphere = async () => {
        const closed = await evaluate(client, `(() => {
          const tab = [...document.querySelectorAll('.pane-tab')]
            .find((candidate) => /スフィア|Sphere/i.test(candidate.textContent ?? ''));
          const close = tab?.querySelector('.pane-tab-close');
          if (!close) return false;
          close.click();
          return true;
        })()`);
        if (!closed) throw new Error("Sphere tab close button was not found.");
        await waitForValue(client, "!document.querySelector('.sphere-view-canvas canvas')");
        await waitForValue(client, `(![...document.querySelectorAll('.pane-tab')]
          .some((candidate) => /スフィア|Sphere/i.test(candidate.textContent ?? '')))`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      };
      const openSphere = async () => {
        const opened = await evaluate(client, `(() => {
          const button = [...document.querySelectorAll('button')].find((candidate) => {
            const label = ((candidate.textContent ?? '') + ' ' + (candidate.getAttribute('aria-label') ?? '')).trim();
            return /スフィア|Sphere/i.test(label);
          });
          button?.click();
          return Boolean(button);
        })()`);
        if (!opened) throw new Error("Sphere navigation button was not found.");
        await waitForValue(client, "Boolean(document.querySelector('.sphere-view-canvas canvas'))", 60_000);
      };
      await closeSphere();
      await client.call("HeapProfiler.collectGarbage");
      const lifecycleHeapBefore = metricMap(await client.call("Performance.getMetrics")).JSHeapUsedSize;
      const heapSamples = [];
      const domSamples = [];
      let maxCanvasCount = 0;
      for (let index = 0; index < cycles; index += 1) {
        await openSphere();
        maxCanvasCount = Math.max(maxCanvasCount, await evaluate(client, "document.querySelectorAll('.sphere-view-canvas canvas').length"));
        await closeSphere();
        await evaluate(client, "window.__sphereAuditFrames.length = 0");
        await client.call("HeapProfiler.collectGarbage");
        heapSamples.push(metricMap(await client.call("Performance.getMetrics")).JSHeapUsedSize);
        domSamples.push(await client.call("Memory.getDOMCounters"));
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await client.call("HeapProfiler.collectGarbage");
      const lifecycleHeapAfter = metricMap(await client.call("Performance.getMetrics")).JSHeapUsedSize;
      lifecycle = {
        cycles,
        heapDeltaBytes: lifecycleHeapAfter - lifecycleHeapBefore,
        domSamples,
        heapSamples,
        heapAfterSettleBytes: lifecycleHeapAfter,
        maxSphereCanvasCount: maxCanvasCount,
        sphereCanvasCount: await evaluate(client, "document.querySelectorAll('.sphere-view-canvas canvas').length")
      };
    }
    const contextLost = await evaluate(client, `([...document.querySelectorAll('.chart-view-status')]
      .some((element) => /3D描画が停止|3D rendering stopped/i.test(element.textContent ?? '')))`);
    return {
      contextLost,
      environment,
      firstOperableMs: readyAt - openedAt,
      interaction: {
        durationMs: interactionEnd - interactionStart,
        frameCount: interactionFrames.length,
        frameTimeMedianMs: summarize(interactionFrameTimes).median,
        frameTimeP95Ms: summarize(interactionFrameTimes).p95
      },
      idle: {
        cpuPercent: (idleProcessBefore.cpuPercent + idleProcessAfter.cpuPercent) / 2,
        frameCount: idleFrames,
        jsHeapDeltaBytes: idleMetricsAfter.JSHeapUsedSize - idleMetricsBefore.JSHeapUsedSize,
        rendererTaskMs: (idleMetricsAfter.TaskDuration - idleMetricsBefore.TaskDuration) * 1_000,
        rssBytes: idleProcessAfter.rssBytes
      },
      lifecycle,
      startup: {
        jsHeapDeltaBytes: (await client.call("Performance.getMetrics").then(metricMap)).JSHeapUsedSize - before.JSHeapUsedSize,
        rendererTaskMs: ((await client.call("Performance.getMetrics").then(metricMap)).TaskDuration - before.TaskDuration) * 1_000
      }
    };
  } finally {
    client?.close();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      const stopped = await Promise.race([
        exited.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 5_000))
      ]);
      if (!stopped && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await Promise.race([
          exited,
          new Promise((resolve) => setTimeout(resolve, 2_000))
        ]);
      }
    }
    child.stdout.destroy();
    child.stderr.destroy();
    if (child.exitCode && stderr.length > 0) {
      process.stderr.write(Buffer.concat(stderr).toString("utf8"));
    }
  }
}

async function main(rawArgs) {
  const options = parseSpherePerformanceArgs(rawArgs);
  await readFile(options.executable);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "relic-sphere-performance-"));
  try {
    const runs = [];
    for (let index = 0; index < options.runs; index += 1) {
      const fixture = await createFixture(path.join(temporaryRoot, `run-${index}`), graphSizes[options.size]);
      runs.push(await runScenario(options.executable, fixture, 9_400 + index, options.cycles));
    }
    const report = {
      fixture: { ...graphSizes[options.size], kind: options.size },
      intentLeadMs: sphereIntentLeadMs,
      host: {
        cpu: os.cpus()[0]?.model ?? "unknown",
        memoryBytes: os.totalmem(),
        os: `${os.type()} ${os.release()}`,
        powerMode: "not detected"
      },
      runs,
      summary: {
        firstOperableMs: summarize(runs.map((run) => run.firstOperableMs)),
        idleFrameCount: summarize(runs.map((run) => run.idle.frameCount)),
        interactionFrameTimeP95Ms: summarize(runs.map((run) => run.interaction.frameTimeP95Ms))
      }
    };
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (options.output) await writeFile(options.output, serialized, "utf8");
    process.stdout.write(serialized);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
