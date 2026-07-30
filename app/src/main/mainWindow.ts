import { BrowserWindow, shell, type App } from "electron";
import { pathToFileURL } from "node:url";

import { devServerLoadUrls, loadDevServerUrlWithRetry } from "./devServerLoader";
import { configureEditorContextMenu } from "./editorContextMenu";
import { attachElectronSmoke, type ElectronSmokeConfig } from "./electronSmoke";
import { configureWindowCloseProtection } from "./windowCloseProtection";
import { createMainWindowOptions } from "./windowOptions";
import {
  installWindowSecurityPolicy,
  isAllowedDevelopmentNavigation,
  isAllowedExternalUrl,
  isAllowedPackagedAppNavigation
} from "./windowSecurity";

interface CreateNormalMainWindowInput {
  app: Pick<App, "exit" | "quit">;
  devServerUrl?: string;
  electronSmokeConfig: ElectronSmokeConfig | null;
  isCloseProtectionBypassed: () => boolean;
  onClosed: (window: BrowserWindow) => void;
  preloadPath: string;
  rendererIndexPath: string;
}

export function createNormalMainWindow({
  app,
  devServerUrl,
  electronSmokeConfig,
  isCloseProtectionBypassed,
  onClosed,
  preloadPath,
  rendererIndexPath
}: CreateNormalMainWindowInput): BrowserWindow {
  const window = new BrowserWindow(createMainWindowOptions({ preloadPath }));
  const rendererIndexUrl = pathToFileURL(rendererIndexPath).toString();

  installWindowSecurityPolicy(window, {
    isNavigationAllowed: (url) => isAllowedMainWindowNavigation(
      url,
      rendererIndexUrl,
      devServerUrl
    ),
    onWindowOpen: (url) => {
      if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    }
  });
  configureEditorContextMenu(window);
  configureWindowCloseProtection(window, isCloseProtectionBypassed);
  attachElectronSmoke(app, window, electronSmokeConfig);
  window.on("closed", () => onClosed(window));

  if (devServerUrl) {
    void loadDevServerUrlWithRetry(window, devServerLoadUrls(devServerUrl));
  } else {
    void window.loadFile(rendererIndexPath);
  }

  return window;
}

export function isAllowedMainWindowNavigation(
  url: string,
  rendererIndexUrl: string,
  devServerUrl?: string
): boolean {
  return devServerUrl
    ? isAllowedDevelopmentNavigation(url, devServerLoadUrls(devServerUrl))
    : isAllowedPackagedAppNavigation(url, rendererIndexUrl);
}
