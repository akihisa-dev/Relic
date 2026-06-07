import path from "node:path";
import { describe, expect, it } from "vitest";

import { createMainWindowOptions, mainWindowMinHeight, mainWindowMinWidth, transientSessionPartition } from "./windowOptions";

describe("createMainWindowOptions", () => {
  it("OSの左右分割を妨げにくい最小サイズにする", () => {
    const options = createMainWindowOptions({
      appPath: "/relic",
      platform: "darwin",
      preloadPath: "/relic/preload.js"
    });

    expect(options.minWidth).toBe(640);
    expect(options.minHeight).toBe(400);
    expect(mainWindowMinWidth).toBeLessThanOrEqual(640);
    expect(mainWindowMinHeight).toBeLessThanOrEqual(400);
  });

  it("macOSでは隠しタイトルバー設定を使う", () => {
    const options = createMainWindowOptions({
      appPath: "/relic",
      platform: "darwin",
      preloadPath: "/relic/preload.js"
    });

    expect(options.icon).toBeUndefined();
    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.trafficLightPosition).toEqual({ x: 10, y: 9 });
  });

  it("Windowsではメニューバーを自動で隠し、アイコンを設定する", () => {
    const options = createMainWindowOptions({
      appPath: "/relic",
      platform: "win32",
      preloadPath: "/relic/preload.js"
    });

    expect(options.autoHideMenuBar).toBe(true);
    expect(options.icon).toBe(path.join("/relic", "assets", "icon.ico"));
  });

  it("ブラウザ保存領域をディスクに残さないメモリセッションを使う", () => {
    const options = createMainWindowOptions({
      appPath: "/relic",
      platform: "darwin",
      preloadPath: "/relic/preload.js"
    });

    expect(options.webPreferences?.partition).toBe(transientSessionPartition);
    expect(transientSessionPartition.startsWith("persist:")).toBe(false);
  });
});
