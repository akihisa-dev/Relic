import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { configureApplicationMenu } from "./applicationMenu";
import { registerAppHandlers } from "./ipc/appHandlers";
import { registerEditorHandlers } from "./ipc/editorHandlers";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { registerOutputHandlers } from "./ipc/outputHandlers";
import { registerToolHandlers } from "./ipc/toolHandlers";
import { registerWorkspaceHandlers } from "./ipc/workspaceHandlers";
import { devServerLoadUrls, loadDevServerUrlWithRetry } from "./devServerLoader";
import { configureDevelopmentUserDataPath } from "./developmentUserData";
import {
  attachElectronSmoke,
  configureElectronSmokeUserDataPath,
  resolveElectronSmokeConfig
} from "./electronSmoke";
import { getMainTranslator } from "./i18n";
import { configureWindowCloseProtection } from "./windowCloseProtection";
import { stopWorkspaceWatcher } from "./workspace/workspaceWatcher";
import { createMainWindowOptions } from "./windowOptions";
import {
  isAllowedDevelopmentNavigation,
  isAllowedExternalUrl,
  isAllowedPackagedAppNavigation
} from "./windowSecurity";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (process.platform !== "darwin") {
  throw new Error(`Relic supports only macOS. Actual platform: ${process.platform}`);
}

const APP_NAME = "Relic";
let isDevelopmentQuitInProgress = false;
let mainWindow: BrowserWindow | null = null;
const electronSmokeConfig = resolveElectronSmokeConfig();

app.setName(APP_NAME);
configureDevelopmentUserDataPath(app, MAIN_WINDOW_VITE_DEV_SERVER_URL, process.env.RELIC_DEV_USER_DATA_DIR);
configureElectronSmokeUserDataPath(app, electronSmokeConfig);

function createWindow(): void {
  const windowOptions = createMainWindowOptions({
    preloadPath: path.join(__dirname, "preload.js")
  });
  const window = new BrowserWindow(windowOptions);
  const rendererIndexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
  const rendererIndexUrl = pathToFileURL(rendererIndexPath).toString();
  mainWindow = window;

  configureWindowSecurity(window, rendererIndexUrl);
  configureEditorContextMenu(window);
  configureWindowCloseProtection(window, () => isDevelopmentQuitInProgress);
  attachElectronSmoke(app, window, electronSmokeConfig);

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

function configureEditorContextMenu(window: BrowserWindow): void {
  window.webContents.on("context-menu", (event, params) => {
    if (!params.isEditable) return;

    event.preventDefault();
    void getMainTranslator().then((t) => {
      Menu.buildFromTemplate([
        { enabled: params.editFlags.canUndo, label: t("editor.undo"), click: () => window.webContents.undo() },
        { enabled: params.editFlags.canRedo, label: t("editor.redo"), click: () => window.webContents.redo() },
        { type: "separator" },
        { enabled: params.editFlags.canCut, label: t("editor.cut"), click: () => window.webContents.cut() },
        { enabled: params.editFlags.canCopy, label: t("editor.copy"), click: () => window.webContents.copy() },
        { enabled: params.editFlags.canPaste, label: t("editor.paste"), click: () => window.webContents.paste() },
        { type: "separator" },
        { enabled: params.editFlags.canSelectAll, label: t("editor.selectAll"), click: () => window.webContents.selectAll() }
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
    return isAllowedDevelopmentNavigation(url, devServerLoadUrls(MAIN_WINDOW_VITE_DEV_SERVER_URL));
  }

  return isAllowedPackagedAppNavigation(url, rendererIndexUrl);
}

app.whenReady().then(async () => {
  await getMainTranslator();
  registerAppHandlers();
  registerEditorHandlers();
  registerFileHandlers();
  registerOutputHandlers();
  registerToolHandlers();
  registerWorkspaceHandlers();
  configureApplicationMenu(() => mainWindow);
  createWindow();


  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  isDevelopmentQuitInProgress = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL || electronSmokeConfig);
  stopWorkspaceWatcher();
});
