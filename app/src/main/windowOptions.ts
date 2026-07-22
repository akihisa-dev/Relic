import type { BrowserWindowConstructorOptions } from "electron";

export const mainWindowMinWidth = 640;
export const mainWindowMinHeight = 400;
export const transientSessionPartition = "relic-main";
export const outputSessionPartition = "relic-output";

interface CreateMainWindowOptionsInput {
  preloadPath: string;
}

export function createMainWindowOptions({
  preloadPath
}: CreateMainWindowOptionsInput): BrowserWindowConstructorOptions {
  return {
    height: 820,
    minHeight: mainWindowMinHeight,
    minWidth: mainWindowMinWidth,
    title: "Relic",
    width: 1240,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 10, y: 9 },
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
