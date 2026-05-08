import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";

import { refreshAutoSyncTimer, stopAutoSyncTimer } from "./autoSyncScheduler";
import { registerAppHandlers } from "./ipc/appHandlers";
import { registerEditorHandlers } from "./ipc/editorHandlers";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerGitHubHandlers } from "./ipc/githubHandlers";
import { registerGitWorkspaceHandlers } from "./ipc/gitWorkspaceHandlers";
import { registerToolHandlers } from "./ipc/toolHandlers";
import { registerWorkspaceHandlers } from "./ipc/workspaceHandlers";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

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
    trafficLightPosition: { x: 10, y: 12 },
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
  registerFileHandlers();
  registerGitHubHandlers();
  registerGitWorkspaceHandlers();
  registerToolHandlers();
  registerWorkspaceHandlers();
  createWindow();

  void refreshAutoSyncTimer();

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
