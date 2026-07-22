import { describe, expect, it } from "vitest";

import {
  createMainWindowOptions,
  mainWindowMinHeight,
  mainWindowMinWidth,
  outputSessionPartition,
  transientSessionPartition
} from "./windowOptions";

describe("createMainWindowOptions", () => {
  it("OSの左右分割を妨げにくい最小サイズにする", () => {
    const options = createMainWindowOptions({
      preloadPath: "/relic/preload.js"
    });

    expect(options.minWidth).toBe(640);
    expect(options.minHeight).toBe(400);
    expect(mainWindowMinWidth).toBeLessThanOrEqual(640);
    expect(mainWindowMinHeight).toBeLessThanOrEqual(400);
  });

  it("macOSでは隠しタイトルバー設定を使う", () => {
    const options = createMainWindowOptions({
      preloadPath: "/relic/preload.js"
    });

    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.trafficLightPosition).toEqual({ x: 10, y: 9 });
  });

  it("ブラウザ保存領域をディスクに残さないメモリセッションを使う", () => {
    const options = createMainWindowOptions({
      preloadPath: "/relic/preload.js"
    });

    expect(options.webPreferences?.partition).toBe(transientSessionPartition);
    expect(transientSessionPartition.startsWith("persist:")).toBe(false);
    expect(outputSessionPartition).not.toBe(transientSessionPartition);
    expect(outputSessionPartition.startsWith("persist:")).toBe(false);
  });

  it("メインウィンドウのセキュリティ境界を固定する", () => {
    const options = createMainWindowOptions({
      preloadPath: "/relic/preload.js"
    });

    expect(options.webPreferences).toEqual(expect.objectContaining({
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      partition: transientSessionPartition,
      preload: "/relic/preload.js",
      sandbox: true,
      webSecurity: true
    }));
  });
});
