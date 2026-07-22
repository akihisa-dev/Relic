import { describe, expect, it, vi } from "vitest";

import {
  developmentAppIdentity,
  parseStartDevelopmentArgs,
  startDevelopmentApp,
} from "./start-development-app.mjs";

describe("start-development-app", () => {
  it("macOSの絶対user data pathを受理する", () => {
    expect(parseStartDevelopmentArgs(["--", "--user-data-dir", "/tmp/relic-dev"]))
      .toEqual({ userDataDir: "/tmp/relic-dev" });
  });

  it("相対pathと不完全な引数を拒否する", () => {
    expect(() => parseStartDevelopmentArgs(["--user-data-dir", "relative"]))
      .toThrow("--user-data-dir must be an absolute path.");
    expect(() => parseStartDevelopmentArgs([]))
      .toThrow("Usage: pnpm start:isolated");
  });

  it("macOS app bundleを起動processへ結び付ける", () => {
    expect(developmentAppIdentity({
      pid: 42,
      spawnfile: "/workspace/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    })).toEqual({
      pid: 42,
      executablePath: "/workspace/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
      appPath: "/workspace/app/node_modules/electron/dist/Electron.app",
    });
  });

  it("起動時に隔離pathを設定し同じprocessのidentityを出力する", async () => {
    const environment = {};
    const writeLine = vi.fn();
    const child = {
      pid: 44,
      spawnfile: "/workspace/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
    };

    await expect(startDevelopmentApp(
      ["--user-data-dir", "/tmp/relic-test"],
      {
        environment,
        start: async () => child,
        writeLine,
      },
    )).resolves.toBe(child);
    expect(environment.RELIC_DEV_USER_DATA_DIR).toBe("/tmp/relic-test");
    expect(writeLine).toHaveBeenCalledWith(
      "RELIC_DEV_APP_IDENTITY={\"pid\":44,\"executablePath\":\"/workspace/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron\",\"appPath\":\"/workspace/app/node_modules/electron/dist/Electron.app\"}",
    );
  });
});
