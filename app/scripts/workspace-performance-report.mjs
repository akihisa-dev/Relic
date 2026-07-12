#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

import { generateLargeWorkspace, positiveInteger } from "./generate-large-workspace.mjs";
import {
  compareLowerIsBetterMetrics,
  median,
  readBaseline,
  renderComparison,
  writeBaseline
} from "./performance-baseline.mjs";

const scenarioOrder = [
  "fileTree",
  "fileIndex",
  "incrementalRefresh",
  "contentSearch",
  "tags",
  "backlinks",
  "graph",
  "chronicle"
];

export async function runWorkspacePerformanceReport({
  directoryCount = 20,
  fileCount = 1000,
  runs = 5,
  warmups = 1,
  workspacePath
} = {}) {
  if (!Number.isInteger(warmups) || warmups < 0) {
    throw new Error("warmups must be a non-negative integer.");
  }
  const temporaryRoot = workspacePath ? null : await mkdtemp(path.join(os.tmpdir(), "relic-performance-"));
  const resolvedWorkspacePath = workspacePath
    ? path.resolve(workspacePath)
    : path.join(temporaryRoot, "workspace");
  const fixture = workspacePath
    ? await fingerprintWorkspace(resolvedWorkspacePath)
    : await generateLargeWorkspace({ directoryCount, fileCount, outputPath: resolvedWorkspacePath });

  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const server = await createServer({
    appType: "custom",
    logLevel: "silent",
    root: process.cwd(),
    server: { middlewareMode: true }
  });

  try {
    const modules = await loadPerformanceModules(server);
    for (let index = 0; index < warmups; index += 1) {
      await runScenarios(resolvedWorkspacePath, modules);
    }

    const samples = Object.fromEntries(scenarioOrder.map((name) => [name, []]));
    const indexStats = [];
    const incrementalStats = [];
    const memoryRuns = [];
    let observations;
    for (let index = 0; index < runs; index += 1) {
      if (typeof globalThis.gc === "function") globalThis.gc();
      const memorySampler = startProcessMemorySampler();
      let result;
      try {
        result = await runScenarios(resolvedWorkspacePath, modules, memorySampler.sample);
      } finally {
        memoryRuns.push(memorySampler.finish());
      }
      for (const name of scenarioOrder) samples[name].push(result.durations[name]);
      indexStats.push(result.indexStats);
      incrementalStats.push(result.incrementalStats);
      observations ??= result.observations;
    }

    const scenarios = Object.fromEntries(scenarioOrder.map((name) => {
      const values = samples[name];
      return [name, {
        maximumMs: round(Math.max(...values)),
        medianMs: round(median(values)),
        minimumMs: round(Math.min(...values)),
        samplesMs: values.map(round)
      }];
    }));
    const medianIndexStats = Object.fromEntries(
      Object.keys(indexStats[0] ?? {}).sort().map((name) => [
        name,
        median(indexStats.map((entry) => entry[name]))
      ])
    );
    const medianIncrementalStats = Object.fromEntries(
      Object.keys(incrementalStats[0] ?? {}).sort().map((name) => [
        name,
        median(incrementalStats.map((entry) => entry[name]))
      ])
    );
    const metrics = buildWorkspacePerformanceMetrics(scenarios, medianIndexStats, medianIncrementalStats);

    return {
      fixture: {
        directoryCount: fixture.directoryCount,
        fileCount: fixture.fileCount,
        fingerprint: fixture.fingerprint
      },
      indexStats: medianIndexStats,
      incrementalStats: medianIncrementalStats,
      kind: "workspace-performance",
      memory: {
        garbageCollection: typeof globalThis.gc === "function" ? "forced-before-run" : "unavailable",
        heapUsed: summarizeMemoryRuns(memoryRuns, "heapUsed"),
        rss: summarizeMemoryRuns(memoryRuns, "rss"),
        runs: memoryRuns
      },
      metrics,
      observations,
      runs,
      scenarios,
      schemaVersion: 1,
      warmups
    };
  } finally {
    await server.close();
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (temporaryRoot) await rm(temporaryRoot, { force: true, recursive: true });
  }
}

export function renderWorkspacePerformanceReport(report) {
  const lines = [
    "Workspace performance",
    `fixture\t${report.fixture.fileCount} files\t${report.fixture.directoryCount} directories\t${report.fixture.fingerprint}`,
    `samples\t${report.runs} runs\t${report.warmups} warmup(s)`,
    "",
    "scenario\tmedian ms\tminimum ms\tmaximum ms"
  ];
  for (const name of scenarioOrder) {
    const scenario = report.scenarios[name];
    lines.push(`${name}\t${scenario.medianMs}\t${scenario.minimumMs}\t${scenario.maximumMs}`);
  }
  lines.push("", "File index operations (median)");
  for (const [name, value] of Object.entries(report.indexStats)) lines.push(`${name}\t${value}`);
  lines.push("", "Incremental refresh operations (median)");
  for (const [name, value] of Object.entries(report.incrementalStats)) lines.push(`${name}\t${value}`);
  lines.push("", "Result observations");
  for (const [name, value] of Object.entries(report.observations)) lines.push(`${name}\t${value}`);
  lines.push(
    "",
    "Process memory (measured runs)",
    `garbage collection\t${report.memory.garbageCollection}`,
    "metric\tstart median bytes\tmaximum bytes\tmaximum increase bytes",
    `heapUsed\t${report.memory.heapUsed.startMedianBytes}\t${report.memory.heapUsed.maximumBytes}\t${report.memory.heapUsed.maximumIncreaseBytes}`,
    `rss\t${report.memory.rss.startMedianBytes}\t${report.memory.rss.maximumBytes}\t${report.memory.rss.maximumIncreaseBytes}`
  );
  return lines.join("\n");
}

export function buildWorkspacePerformanceMetrics(scenarios, indexStats, incrementalStats) {
  const metrics = {};
  for (const [name, scenario] of Object.entries(scenarios)) {
    metrics[`duration.${name}.medianMs`] = scenario.medianMs;
  }
  for (const name of ["readFileCount", "readHeadCount", "statCount"]) {
    metrics[`operation.fileIndex.${name}`] = indexStats[name];
    metrics[`operation.incrementalRefresh.${name}`] = incrementalStats[name];
  }
  return metrics;
}

export function startProcessMemorySampler({
  intervalMs = 10,
  readMemory = () => process.memoryUsage()
} = {}) {
  const started = readMemory();
  let maximumHeapUsed = started.heapUsed;
  let maximumRss = started.rss;
  let samples = 1;

  const sample = () => {
    const current = readMemory();
    maximumHeapUsed = Math.max(maximumHeapUsed, current.heapUsed);
    maximumRss = Math.max(maximumRss, current.rss);
    samples += 1;
  };
  const timer = intervalMs > 0 ? setInterval(sample, intervalMs) : null;
  timer?.unref?.();

  return {
    finish() {
      if (timer) clearInterval(timer);
      sample();
      return {
        heapUsed: {
          increaseBytes: maximumHeapUsed - started.heapUsed,
          maximumBytes: maximumHeapUsed,
          startBytes: started.heapUsed
        },
        rss: {
          increaseBytes: maximumRss - started.rss,
          maximumBytes: maximumRss,
          startBytes: started.rss
        },
        samples
      };
    },
    sample
  };
}

export function summarizeMemoryRuns(runs, metric) {
  return {
    maximumBytes: Math.max(...runs.map((run) => run[metric].maximumBytes)),
    maximumIncreaseBytes: Math.max(...runs.map((run) => run[metric].increaseBytes)),
    startMedianBytes: median(runs.map((run) => run[metric].startBytes))
  };
}

async function loadPerformanceModules(server) {
  const [fileTree, fileIndex, search, derivedData, derivedDataSession, tags, backlinks, graph, charts] = await Promise.all([
    server.ssrLoadModule("/src/main/files/fileTree.ts"),
    server.ssrLoadModule("/src/main/files/workspaceFileIndex.ts"),
    server.ssrLoadModule("/src/main/files/search.ts"),
    server.ssrLoadModule("/src/main/files/workspaceDerivedData.ts"),
    server.ssrLoadModule("/src/main/files/workspaceDerivedDataSession.ts"),
    server.ssrLoadModule("/src/main/files/tags.ts"),
    server.ssrLoadModule("/src/main/files/backlinks.ts"),
    server.ssrLoadModule("/src/main/files/workspaceGraph.ts"),
    server.ssrLoadModule("/src/main/files/charts.ts")
  ]);
  return { backlinks, charts, derivedData, derivedDataSession, fileIndex, fileTree, graph, search, tags };
}

async function runScenarios(workspacePath, modules, sampleMemory = () => undefined) {
  const durations = {};
  const [fileTree, fileTreeDuration] = await measure(
    () => modules.fileTree.readWorkspaceFileTree(workspacePath),
    sampleMemory
  );
  durations.fileTree = fileTreeDuration;

  const [fileIndex, fileIndexDuration] = await measure(() => modules.fileIndex.readWorkspaceFileIndex(
    workspacePath,
    { fileTree }
  ), sampleMemory);
  durations.fileIndex = fileIndexDuration;

  const targetPath = "section-000/note-00001.md";
  const session = new modules.derivedDataSession.WorkspaceDerivedDataSession();
  const sessionRequest = {
    fileIndex,
    filePaths: fileIndex.entries.map((entry) => entry.path),
    workspaceId: "performance",
    workspacePath
  };
  await session.getSnapshot(sessionRequest);
  sampleMemory();
  session.invalidate("performance", [targetPath]);
  const [incrementalSnapshot, incrementalDuration] = await measure(
    () => session.getSnapshot(sessionRequest),
    sampleMemory
  );
  durations.incrementalRefresh = incrementalDuration;

  const parseCache = modules.derivedData.createWorkspaceDerivedDataCache();
  const sharedOptions = { fileIndex, fileTree, parseCache };
  const [searchResult, searchDuration] = await measure(() => modules.search.searchWorkspace(
    workspacePath,
    "__relic_performance_no_match__",
    "fullText",
    undefined,
    sharedOptions
  ), sampleMemory);
  ensureResult(searchResult, "content search");
  durations.contentSearch = searchDuration;

  const [tagResult, tagsDuration] = await measure(
    () => modules.tags.readWorkspaceTags(workspacePath, sharedOptions),
    sampleMemory
  );
  ensureResult(tagResult, "tags");
  durations.tags = tagsDuration;

  const [backlinkResult, backlinksDuration] = await measure(
    () => modules.backlinks.readBacklinks(workspacePath, targetPath, sharedOptions),
    sampleMemory
  );
  ensureResult(backlinkResult, "backlinks");
  durations.backlinks = backlinksDuration;

  const [graphResult, graphDuration] = await measure(
    () => modules.graph.readWorkspaceGraph(workspacePath, sharedOptions),
    sampleMemory
  );
  ensureResult(graphResult, "graph");
  durations.graph = graphDuration;

  const [chartResult, chronicleDuration] = await measure(() => modules.charts.readWorkspaceCharts(
    workspacePath,
    [{ id: "performance", name: "Performance", source: "chronicle" }],
    undefined,
    sharedOptions
  ), sampleMemory);
  ensureResult(chartResult, "chronicle");
  durations.chronicle = chronicleDuration;

  return {
    durations,
    incrementalStats: incrementalSnapshot.fileIndex.stats,
    indexStats: fileIndex.stats,
    observations: {
      backlinks: backlinkResult.value.length,
      chronicleEntries: chartResult.value[0]?.entries.length ?? 0,
      graphLinks: graphResult.value.links.length,
      graphNodes: graphResult.value.nodes.length,
      searchResults: searchResult.value.results.length,
      tags: tagResult.value.length
    }
  };
}

async function measure(operation, sampleMemory = () => undefined) {
  sampleMemory();
  const startedAt = performance.now();
  const result = await operation();
  sampleMemory();
  return [result, performance.now() - startedAt];
}

function ensureResult(result, label) {
  if (!result.ok) throw new Error(`${label} benchmark failed: ${result.error.code}`);
}

async function fingerprintWorkspace(workspacePath) {
  const hash = createHash("sha256");
  let directoryCount = 0;
  let fileCount = 0;

  async function walk(directory, relativeDirectory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
      if (entry.name.startsWith(".") || ["build", "dist", "node_modules", "out"].includes(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        directoryCount += 1;
        await walk(absolutePath, relativePath);
      } else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith(".md")) {
        fileCount += 1;
        hash.update(relativePath);
        hash.update("\0");
        hash.update(await readFile(absolutePath));
        hash.update("\0");
      }
    }
  }

  await stat(workspacePath);
  await walk(workspacePath, "");
  return { directoryCount, fileCount, fingerprint: hash.digest("hex"), outputPath: workspacePath };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runWorkspacePerformanceReport({
    directoryCount: positiveInteger(args.directories ?? "20", "directories"),
    fileCount: positiveInteger(args.files ?? "1000", "files"),
    runs: positiveInteger(args.runs ?? "5", "runs"),
    warmups: Number.parseInt(args.warmups ?? "1", 10),
    workspacePath: args.workspace
  });
  console.log(renderWorkspacePerformanceReport(report));

  if (args.json) {
    const jsonPath = path.resolve(args.json);
    await mkdir(path.dirname(jsonPath), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (args["write-baseline"]) {
    const baselinePath = await writeBaseline(args["write-baseline"], report);
    console.log(`\nBaseline written: ${baselinePath}`);
  }
  if (args.baseline) {
    const baseline = await readBaseline(path.resolve(args.baseline), "workspace-performance");
    if (baseline.fixture?.fingerprint !== report.fixture.fingerprint) {
      throw new Error("Workspace performance baseline uses a different fixture fingerprint.");
    }
    const comparison = compareLowerIsBetterMetrics(
      report.metrics,
      baseline.metrics,
      Number(args["max-regression-percent"] ?? "15")
    );
    console.log(`\n${renderComparison(comparison)}`);
    if (comparison.regressions.length > 0) process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
