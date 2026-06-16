import type { BrowserWindowConstructorOptions } from "electron";
import path from "node:path";

export const mainWindowMinWidth = 640;
export const mainWindowMinHeight = 400;
export const transientSessionPartition = "relic-main";
export const outputSessionPartition = "relic-output";

interface CreateMainWindowOptionsInput {
  appPath: string;
  platform: NodeJS.Platform;
  preloadPath: string;
}

export function createMainWindowOptions({
  appPath,
  platform,
  preloadPath
}: CreateMainWindowOptionsInput): BrowserWindowConstructorOptions {
  const isMac = platform === "darwin";

  return {
    height: 820,
    icon: isMac ? undefined : path.join(appPath, "assets", "icon.ico"),
    minHeight: mainWindowMinHeight,
    minWidth: mainWindowMinWidth,
    title: "Relic",
    width: 1240,
    autoHideMenuBar: platform === "win32",
    ...(isMac
      ? {
          titleBarStyle: "hiddenInset",
          trafficLightPosition: { x: 10, y: 9 }
        }
      : {}),
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      partition: transientSessionPartition,
      preload: preloadPath,
      sandbox: true,
      webSecurity: true
    }
  };
}
