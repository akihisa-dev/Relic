import { app, BrowserWindow, Menu, ipcMain, shell, type BrowserWindowConstructorOptions } from "electron";
import path from "node:path";

import { registerAppHandlers } from "./ipc/appHandlers";
import { registerEditorHandlers } from "./ipc/editorHandlers";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerToolHandlers } from "./ipc/toolHandlers";
import { registerWorkspaceHandlers } from "./ipc/workspaceHandlers";
import { windowCloseRequestedChannel, windowCloseResponseChannel, type WindowCloseResponseInput } from "../shared/ipc";
import { devServerLoadUrls, loadDevServerUrlWithRetry } from "./devServerLoader";
import { stopWorkspaceWatcher } from "./workspace/workspaceWatcher";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const APP_ID = "app.relic.desktop";
const CLOSE_CONFIRM_TIMEOUT_MS = 5000;

const approvedWindowCloseIds = new WeakSet<BrowserWindow>();
let mainWindow: BrowserWindow | null = null;

if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

function createWindow(): void {
  const isMac = process.platform === "darwin";
  const icon = isMac ? undefined : path.join(app.getAppPath(), "assets", "icon.ico");
  const windowOptions: BrowserWindowConstructorOptions = {
    height: 820,
    icon,
    minHeight: 640,
    minWidth: 960,
    title: "Relic",
    width: 1240,
    autoHideMenuBar: process.platform === "win32",
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 10, y: 12 }
        }
      : {}),
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      webSecurity: true
    }
  };
  const window = new BrowserWindow(windowOptions);
  mainWindow = window;

  configureWindowSecurity(window);
  configureEditorContextMenu(window);
  configureWindowCloseProtection(window);

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void loadDevServerUrlWithRetry(window, devServerLoadUrls(MAIN_WINDOW_VITE_DEV_SERVER_URL));
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
}

function configureWindowCloseProtection(window: BrowserWindow): void {
  window.on("close", (event) => {
    if (approvedWindowCloseIds.has(window)) {
      approvedWindowCloseIds.delete(window);
      return;
    }

    if (window.webContents.isDestroyed()) return;

    event.preventDefault();

    const requestId = `close-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled || window.isDestroyed()) return;
      settled = true;
    }, CLOSE_CONFIRM_TIMEOUT_MS);

    ipcMain.once(windowCloseResponseChannel, (_event, input: WindowCloseResponseInput) => {
      if (settled || input.requestId !== requestId) return;

      settled = true;
      clearTimeout(timer);

      if (!input.ok || window.isDestroyed()) return;

      approvedWindowCloseIds.add(window);
      window.close();
    });

    window.webContents.send(windowCloseRequestedChannel, { requestId });
  });
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
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return devServerLoadUrls(MAIN_WINDOW_VITE_DEV_SERVER_URL).some((devServerUrl) => url.startsWith(devServerUrl));
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
  registerToolHandlers();
  registerWorkspaceHandlers();
  createWindow();


  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopWorkspaceWatcher();
});
