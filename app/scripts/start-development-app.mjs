import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const appRoot = path.resolve(scriptDir, "..");

function pathApi(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

export function parseStartDevelopmentArgs(rawArgs, platform = process.platform) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  if (args.length !== 2 || args[0] !== "--user-data-dir") {
    throw new Error("Usage: pnpm start:isolated -- --user-data-dir <absolute-path>");
  }

  const userDataDir = args[1];
  if (!pathApi(platform).isAbsolute(userDataDir)) {
    throw new Error("--user-data-dir must be an absolute path.");
  }

  return { userDataDir };
}

export function developmentAppIdentity(child, platform = process.platform) {
  if (!Number.isInteger(child.pid) || child.pid <= 0) {
    throw new Error("Electron did not return a usable process ID.");
  }

  const executablePath = child.spawnfile;
  if (typeof executablePath !== "string" || !pathApi(platform).isAbsolute(executablePath)) {
    throw new Error("Electron did not return an absolute executable path.");
  }

  const marker = ".app/Contents/MacOS/";
  const markerIndex = platform === "darwin" ? executablePath.indexOf(marker) : -1;
  const appPath = markerIndex >= 0
    ? executablePath.slice(0, markerIndex + ".app".length)
    : executablePath;

  return { pid: child.pid, executablePath, appPath };
}

export async function startDevelopmentApp(rawArgs, dependencies = {}) {
  const { userDataDir } = parseStartDevelopmentArgs(
    rawArgs,
    dependencies.platform ?? process.platform,
  );
  const environment = dependencies.environment ?? process.env;
  environment.RELIC_DEV_USER_DATA_DIR = userDataDir;

  const start = dependencies.start ?? (async () => {
    const { api } = await import("@electron-forge/core");
    return api.start({ dir: appRoot, interactive: true });
  });
  const child = await start();
  const identity = developmentAppIdentity(child, dependencies.platform ?? process.platform);
  (dependencies.writeLine ?? console.info)(`RELIC_DEV_APP_IDENTITY=${JSON.stringify(identity)}`);
  return child;
}

function attachLifecycle(child) {
  const stopChild = () => {
    if (!child.killed) child.kill("SIGTERM");
  };
  process.once("SIGINT", stopChild);
  process.once("SIGTERM", stopChild);
  child.once("exit", (code) => {
    process.off("SIGINT", stopChild);
    process.off("SIGTERM", stopChild);
    process.stdin.pause();
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    attachLifecycle(await startDevelopmentApp(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
