import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const appDirectory = path.resolve(scriptDirectory, "..");
const timeoutMilliseconds = 120_000;

export function parseElectronSmokeArgs(rawArgs) {
  const args = rawArgs.filter((argument) => argument !== "--");
  const kind = args[0];
  if (kind !== "development" && kind !== "package") {
    throw new Error("Usage: pnpm smoke:electron <development|package> [--artifacts-dir <path>]");
  }
  if (args.length === 1) return { artifactsDirectory: null, kind };
  if (args.length !== 3 || args[1] !== "--artifacts-dir") {
    throw new Error("Usage: pnpm smoke:electron <development|package> [--artifacts-dir <path>]");
  }
  return { artifactsDirectory: path.resolve(args[2]), kind };
}

export async function findPackagedExecutable(platform, applicationDirectory = appDirectory) {
  if (platform !== "darwin" && platform !== "win32") {
    throw new Error(`Package smoke is supported only on macOS and Windows. Actual platform: ${platform}`);
  }

  const outputDirectory = path.join(applicationDirectory, "out", platform);
  const prefix = platform === "darwin" ? "Relic-darwin-" : "Relic-win32-";
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const packagedDirectory = entries.find((entry) => entry.isDirectory() && entry.name.startsWith(prefix));
  if (!packagedDirectory) {
    throw new Error(`Packaged application was not found under ${outputDirectory}.`);
  }

  const root = path.join(outputDirectory, packagedDirectory.name);
  return platform === "darwin"
    ? path.join(root, "Relic.app", "Contents", "MacOS", "Relic")
    : path.join(root, "Relic.exe");
}

function mirrorOutput(stream, target, chunks) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    chunks.push(text);
    target.write(text);
  });
}

async function terminateChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000))
  ]);
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function runElectronSmoke(rawArgs) {
  const { artifactsDirectory: configuredArtifactsDirectory, kind } = parseElectronSmokeArgs(rawArgs);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "relic-electron-smoke-"));
  const userDataDirectory = path.join(temporaryRoot, "user-data");
  const artifactsDirectory = configuredArtifactsDirectory ?? path.join(temporaryRoot, "artifacts");
  const reportPath = path.join(artifactsDirectory, `${kind}-report.json`);
  const stdoutPath = path.join(artifactsDirectory, `${kind}-stdout.log`);
  const stderrPath = path.join(artifactsDirectory, `${kind}-stderr.log`);
  await mkdir(userDataDirectory, { recursive: true });
  await mkdir(artifactsDirectory, { recursive: true });

  const stdout = [];
  const stderr = [];
  let child;
  let timeout;

  try {
    const command = kind === "development" ? process.execPath : await findPackagedExecutable(process.platform);
    const args = kind === "development"
      ? [path.join("scripts", "start-development-app.mjs"), "--user-data-dir", userDataDirectory]
      : [];
    child = spawn(command, args, {
      cwd: appDirectory,
      env: {
        ...process.env,
        RELIC_ELECTRON_SMOKE_KIND: kind,
        RELIC_ELECTRON_SMOKE_REPORT_PATH: reportPath,
        RELIC_ELECTRON_SMOKE_USER_DATA_DIR: userDataDirectory
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    mirrorOutput(child.stdout, process.stdout, stdout);
    mirrorOutput(child.stderr, process.stderr, stderr);

    const exit = await Promise.race([
      new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Electron smoke timed out after ${timeoutMilliseconds}ms.`)), timeoutMilliseconds);
      })
    ]);

    if (exit.signal || exit.code !== 0) {
      throw new Error(`Electron smoke exited with ${exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? 1}`}.`);
    }

    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (report.status !== "passed" || report.kind !== kind || !Object.values(report.checks ?? {}).every(Boolean)) {
      throw new Error("Electron smoke report did not prove all startup checks passed.");
    }
    console.info(`[electron-smoke] Verified ${kind} startup. Evidence: ${artifactsDirectory}`);
  } finally {
    if (timeout) clearTimeout(timeout);
    await terminateChild(child);
    try {
      await writeFile(stdoutPath, stdout.join(""), "utf8");
      await writeFile(stderrPath, stderr.join(""), "utf8");
    } finally {
      await rm(configuredArtifactsDirectory ? temporaryRoot : userDataDirectory, { force: true, recursive: true });
    }
    if (!configuredArtifactsDirectory) {
      console.info(`[electron-smoke] Evidence retained at ${artifactsDirectory}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    await runElectronSmoke(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
