import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { registerAppHandlers } from "./ipc/appHandlers";
import { registerEditorHandlers } from "./ipc/editorHandlers";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerOutputHandlers } from "./ipc/outputHandlers";
import { registerToolHandlers } from "./ipc/toolHandlers";
import { registerWorkspaceHandlers } from "./ipc/workspaceHandlers";
import { windowCloseRequestedChannel, windowCloseResponseChannel, type WindowCloseResponseInput } from "../shared/ipc";
import { devServerLoadUrls, loadDevServerUrlWithRetry } from "./devServerLoader";
import { getMainTranslator } from "./i18n";
import { stopWorkspaceWatcher } from "./workspace/workspaceWatcher";
import { createMainWindowOptions } from "./windowOptions";
import { isAllowedExternalUrl, isAllowedPackagedAppNavigation } from "./windowSecurity";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const APP_ID = "app.relic.desktop";
const CLOSE_CONFIRM_TIMEOUT_MS = 5000;

const approvedWindowCloseIds = new WeakSet<BrowserWindow>();
let isDevelopmentQuitInProgress = false;
let mainWindow: BrowserWindow | null = null;

if (process.platform === "win32") {
  app.setAppUserModelId(APP_ID);
}

function createWindow(): void {
  const windowOptions = createMainWindowOptions({
    appPath: app.getAppPath(),
    platform: process.platform,
    preloadPath: path.join(__dirname, "preload.js")
  });
  const window = new BrowserWindow(windowOptions);
  const rendererIndexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
  const rendererIndexUrl = pathToFileURL(rendererIndexPath).toString();
  mainWindow = window;

  configureWindowSecurity(window, rendererIndexUrl);
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
    void window.loadFile(rendererIndexPath);
  }
}

function configureWindowCloseProtection(window: BrowserWindow): void {
  window.on("close", (event) => {
    if (isDevelopmentQuitInProgress) return;

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
    void getMainTranslator().then((t) => {
      Menu.buildFromTemplate([
        { enabled: params.editFlags.canUndo, label: t("editor.undo"), click: () => window.webContents.undo() },
        { enabled: params.editFlags.canRedo, label: t("editor.redo"), click: () => window.webContents.redo() },
        { type: "separator" },
        { label: t("editor.cut"), click: () => window.webContents.cut() },
        { label: t("editor.copy"), click: () => window.webContents.copy() },
        { label: t("editor.paste"), click: () => window.webContents.paste() },
        { type: "separator" },
        { label: t("editor.selectAll"), click: () => window.webContents.selectAll() }
      ]).popup({ window });
    });
  });
}

function configureWindowSecurity(window: BrowserWindow, rendererIndexUrl: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedAppNavigation(url, rendererIndexUrl)) {
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

function isAllowedAppNavigation(url: string, rendererIndexUrl: string): boolean {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return devServerLoadUrls(MAIN_WINDOW_VITE_DEV_SERVER_URL).some((devServerUrl) => url.startsWith(devServerUrl));
  }

  return isAllowedPackagedAppNavigation(url, rendererIndexUrl);
}

app.whenReady().then(() => {
  registerAppHandlers();
  registerEditorHandlers();
  registerFileHandlers();
  registerOutputHandlers();
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
  isDevelopmentQuitInProgress = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  stopWorkspaceWatcher();
});
