import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { App, BrowserWindow } from "electron";

const REPORT_PATH_VARIABLE = "RELIC_ELECTRON_SMOKE_REPORT_PATH";
const USER_DATA_VARIABLE = "RELIC_ELECTRON_SMOKE_USER_DATA_DIR";
const KIND_VARIABLE = "RELIC_ELECTRON_SMOKE_KIND";

export interface ElectronSmokeConfig {
  kind: "development" | "package";
  reportPath: string;
  userDataPath: string;
}

interface ElectronSmokeReport {
  checks: {
    initialWorkspaceIsEmpty: boolean;
    mainWindowCreated: boolean;
    preloadApiAvailable: boolean;
    rendererLoaded: boolean;
    workspaceIpcConnected: boolean;
  };
  diagnostics: string[];
  finishedAt: string;
  kind: ElectronSmokeConfig["kind"];
  startedAt: string;
  status: "failed" | "passed";
}

export function resolveElectronSmokeConfig(
  environment: NodeJS.ProcessEnv = process.env
): ElectronSmokeConfig | null {
  const reportPath = environment[REPORT_PATH_VARIABLE];
  const userDataPath = environment[USER_DATA_VARIABLE];
  const kind = environment[KIND_VARIABLE];

  if (!reportPath && !userDataPath && !kind) return null;
  if (!reportPath || !userDataPath || (kind !== "development" && kind !== "package")) {
    throw new Error(
      `${REPORT_PATH_VARIABLE}, ${USER_DATA_VARIABLE}, and ${KIND_VARIABLE} must be set together for an Electron smoke run.`
    );
  }
  if (!path.isAbsolute(reportPath) || !path.isAbsolute(userDataPath)) {
    throw new Error("Electron smoke report and user data paths must be absolute paths.");
  }

  return {
    kind,
    reportPath: path.resolve(reportPath),
    userDataPath: path.resolve(userDataPath)
  };
}

export function configureElectronSmokeUserDataPath(
  app: Pick<App, "setPath">,
  config: ElectronSmokeConfig | null
): boolean {
  if (!config) return false;
  app.setPath("userData", config.userDataPath);
  return true;
}

export function attachElectronSmoke(
  app: Pick<App, "exit" | "quit">,
  window: BrowserWindow,
  config: ElectronSmokeConfig | null
): void {
  if (!config) return;

  const startedAt = new Date().toISOString();
  const diagnostics: string[] = [];
  let finished = false;

  const finish = async (
    status: ElectronSmokeReport["status"],
    checks: ElectronSmokeReport["checks"],
    diagnostic?: string
  ): Promise<void> => {
    if (finished) return;
    finished = true;
    if (diagnostic) diagnostics.push(diagnostic);

    const report: ElectronSmokeReport = {
      checks,
      diagnostics,
      finishedAt: new Date().toISOString(),
      kind: config.kind,
      startedAt,
      status
    };

    try {
      await mkdir(path.dirname(config.reportPath), { recursive: true });
      await writeFile(config.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    } catch (error) {
      console.error("[electron-smoke] Failed to write report.", error);
      app.exit(1);
      return;
    }

    if (status === "passed") {
      console.info(`[electron-smoke] Passed ${config.kind} startup checks.`);
      app.quit();
    } else {
      console.error(`[electron-smoke] Failed ${config.kind} startup checks: ${diagnostic ?? "unknown failure"}`);
      app.exit(1);
    }
  };

  const emptyChecks = (): ElectronSmokeReport["checks"] => ({
    initialWorkspaceIsEmpty: false,
    mainWindowCreated: true,
    preloadApiAvailable: false,
    rendererLoaded: false,
    workspaceIpcConnected: false
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    void finish("failed", emptyChecks(), `Renderer process ended unexpectedly: ${details.reason}`);
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    void finish("failed", emptyChecks(), `Renderer failed to load (${code}): ${description}`);
  });
  window.webContents.once("did-finish-load", () => {
    void window.webContents.executeJavaScript(`
      (async () => {
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          const root = document.getElementById("root");
          if (root?.childElementCount && typeof window.relic?.getWorkspaceState === "function") {
            const stateResult = await window.relic.getWorkspaceState();
            return {
              initialWorkspaceIsEmpty: Boolean(
                stateResult?.ok &&
                stateResult.value.activeWorkspace === null &&
                stateResult.value.workspaces.length === 0
              ),
              mainWindowCreated: true,
              preloadApiAvailable: true,
              rendererLoaded: true,
              workspaceIpcConnected: Boolean(stateResult?.ok)
            };
          }
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        throw new Error("Renderer readiness timed out.");
      })()
    `).then(
      (checks: ElectronSmokeReport["checks"]) => {
        const passed = Object.values(checks).every(Boolean);
        void finish(
          passed ? "passed" : "failed",
          checks,
          passed ? undefined : "One or more startup checks did not pass."
        );
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        void finish("failed", emptyChecks(), `Renderer readiness check failed: ${message}`);
      }
    );
  });
}
