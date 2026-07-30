import { app, BrowserWindow, dialog, shell } from "electron";
import path from "node:path";

import { configureDevelopmentUserDataPath } from "./developmentUserData";
import {
  configureElectronSmokeUserDataPath,
  resolveElectronSmokeConfig
} from "./electronSmoke";
import { getCachedMainTranslator, setMainTranslator } from "./i18n";
import { createNormalMainWindow } from "./mainWindow";
import { createNormalApplicationInitializer } from "./normalApplication";
import {
  readAppSettingsForStartup,
  replaceAppSettingsWithDefaults,
  type AppSettingsRecoveryState
} from "./settings/appSettingsRecovery";
import { createAppSettingsRecoveryWindow } from "./settings/appSettingsRecoveryWindow";
import { stopWorkspaceWatcher } from "./workspace/workspaceWatcher";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (process.platform !== "darwin") {
  throw new Error(`Relic supports only macOS. Actual platform: ${process.platform}`);
}

const APP_NAME = "Relic";
let isDevelopmentQuitInProgress = false;
let mainWindow: BrowserWindow | null = null;
let settingsRecovery: AppSettingsRecoveryState | null = null;
const electronSmokeConfig = resolveElectronSmokeConfig();
const initializeNormalApplication = createNormalApplicationInitializer(() => mainWindow);

app.setName(APP_NAME);
configureDevelopmentUserDataPath(app, MAIN_WINDOW_VITE_DEV_SERVER_URL, process.env.RELIC_DEV_USER_DATA_DIR);
configureElectronSmokeUserDataPath(app, electronSmokeConfig);

function createWindow(): void {
  if (settingsRecovery) {
    createSettingsRecoveryWindow(settingsRecovery);
    return;
  }

  createNormalWindow();
}

function createNormalWindow(): void {
  const rendererIndexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
  const window = createNormalMainWindow({
    app,
    devServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
    electronSmokeConfig,
    isCloseProtectionBypassed: () => isDevelopmentQuitInProgress,
    onClosed: (closedWindow) => {
      if (mainWindow === closedWindow) mainWindow = null;
    },
    preloadPath: path.join(__dirname, "preload.js"),
    rendererIndexPath
  });
  mainWindow = window;
}

function createSettingsRecoveryWindow(recovery: AppSettingsRecoveryState): void {
  let recoveryWindow: BrowserWindow;
  recoveryWindow = createAppSettingsRecoveryWindow({
    onExit: () => app.quit(),
    onShowLocation: (targetPath) => shell.showItemInFolder(targetPath),
    onStartDefaults: async () => {
      const settings = await replaceAppSettingsWithDefaults(app.getPath("userData"), recovery);
      setMainTranslator(settings.editorSettings.language);
      settingsRecovery = null;
      initializeNormalApplication();

      if (!recoveryWindow.isDestroyed()) recoveryWindow.destroy();
      createNormalWindow();
    },
    onStartDefaultsFailed: () => {
      const t = getCachedMainTranslator();
      dialog.showErrorBox(
        t("settingsRecovery.startFailedTitle"),
        t("settingsRecovery.startFailedMessage")
      );
    },
    recovery,
    t: getCachedMainTranslator()
  });
  mainWindow = recoveryWindow;

  recoveryWindow.on("closed", () => {
    if (mainWindow === recoveryWindow) {
      mainWindow = null;
    }
  });
}

app.whenReady().then(async () => {
  const startup = await readAppSettingsForStartup(app.getPath("userData"));

  if (startup.status === "ready") {
    setMainTranslator(startup.settings.editorSettings.language);
    initializeNormalApplication();
  } else {
    settingsRecovery = startup.recovery;
    setMainTranslator("system");
  }

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
