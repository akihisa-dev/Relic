import { app, BrowserWindow, ipcMain } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";

import { autoCommitAndPush, pullGitBranch } from "./files/git";
import { readGitHubAuthFromKeychain } from "./github/keychain";
import { registerAppHandlers } from "./ipc/appHandlers";
import { registerEditorHandlers } from "./ipc/editorHandlers";
import { registerGitHubHandlers } from "./ipc/githubHandlers";
import { registerWorkspaceHandlers } from "./ipc/workspaceHandlers";
import { readAppSettings } from "./settings/appSettings";
import { saveAutoSyncSettingsChannel } from "../shared/ipc";
import { toWorkspaceState } from "./workspace/workspaceService";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

function startAutoSyncTimer(intervalMinutes: number): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }

  autoSyncTimer = setInterval(() => {
    void runAutoSync();
  }, intervalMinutes * 60 * 1000);
}

function stopAutoSyncTimer(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

async function runAutoSync(): Promise<void> {
  try {
    const settings = await readAppSettings(app.getPath("userData"));
    const state = toWorkspaceState(settings);

    if (!state.activeWorkspace) {
      return;
    }

    const { autoSync } = settings;
    const auth = autoSync.autoPush ? await readGitHubAuthFromKeychain() : null;

    if (autoSync.autoPull) {
      await pullGitBranch(state.activeWorkspace.path);
    }

    if (autoSync.autoPush && auth) {
      await autoCommitAndPush(state.activeWorkspace.path, auth.login, auth.accessToken);
    }
  } catch {
    // Auto-sync errors are silent — don't crash the app
  }
}

if (started) {
  app.quit();
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    height: 820,
    minHeight: 640,
    minWidth: 960,
    title: "Relic",
    titleBarStyle: "hiddenInset",
    width: 1240,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

app.whenReady().then(() => {
  registerAppHandlers();
  registerEditorHandlers();
  registerGitHubHandlers();
  registerWorkspaceHandlers();
  createWindow();

  void readAppSettings(app.getPath("userData")).then((settings) => {
    const { autoSync } = settings;

    if (autoSync.autoPull || autoSync.autoPush) {
      startAutoSyncTimer(autoSync.intervalMinutes);
    }
  });

  ipcMain.on(saveAutoSyncSettingsChannel, (_event, input: { autoPull: boolean; autoPush: boolean; intervalMinutes: number }) => {
    if (input.autoPull || input.autoPush) {
      startAutoSyncTimer(input.intervalMinutes);
    } else {
      stopAutoSyncTimer();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopAutoSyncTimer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
