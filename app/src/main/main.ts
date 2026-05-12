import { app, BrowserWindow, Menu, shell } from "electron";
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
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      webSecurity: true
    }
  });

  configureWindowSecurity(mainWindow);
  configureEditorContextMenu(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

function configureEditorContextMenu(window: BrowserWindow): void {
  window.webContents.on("context-menu", (event, params) => {
    if (!params.isEditable) return;

    event.preventDefault();
    Menu.buildFromTemplate([
      { enabled: params.editFlags.canUndo, label: "取り消し", click: () => window.webContents.undo() },
      { enabled: params.editFlags.canRedo, label: "やり直し", click: () => window.webContents.redo() },
      { type: "separator" },
      { label: "カット", click: () => window.webContents.cut() },
      { label: "コピー", click: () => window.webContents.copy() },
      { label: "ペースト", click: () => window.webContents.paste() },
      { type: "separator" },
      { label: "すべて選択", click: () => window.webContents.selectAll() }
    ]).popup({ window });
  });
}

function configureWindowSecurity(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppNavigation(url)) {
      event.preventDefault();
    }
  });

  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function isAllowedAppNavigation(url: string): boolean {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
    return true;
  }

  return url.startsWith("file://");
}

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "https:" && (
      parsed.hostname === "github.com" ||
      parsed.hostname.endsWith(".github.com")
    );
  } catch {
    return false;
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
