import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BrowserWindow } from "electron";

import {
  attachElectronSmoke,
  configureElectronSmokeUserDataPath,
  resolveElectronSmokeConfig
} from "./electronSmoke";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("electronSmoke", () => {
  it("設定がない通常起動では無効になる", () => {
    expect(resolveElectronSmokeConfig({})).toBeNull();
  });

  it("隔離用userDataとreportの絶対パスを受け付ける", () => {
    const root = path.join(os.tmpdir(), "relic-smoke");
    const config = resolveElectronSmokeConfig({
      RELIC_ELECTRON_SMOKE_KIND: "development",
      RELIC_ELECTRON_SMOKE_REPORT_PATH: path.join(root, "report.json"),
      RELIC_ELECTRON_SMOKE_USER_DATA_DIR: path.join(root, "user-data")
    });
    const app = { setPath: vi.fn() };

    expect(config).toEqual({
      kind: "development",
      reportPath: path.join(root, "report.json"),
      userDataPath: path.join(root, "user-data")
    });
    expect(configureElectronSmokeUserDataPath(app, config)).toBe(true);
    expect(app.setPath).toHaveBeenCalledWith("userData", path.join(root, "user-data"));
  });

  it("一部だけの設定と相対パスを拒否する", () => {
    expect(() => resolveElectronSmokeConfig({
      RELIC_ELECTRON_SMOKE_KIND: "package",
      RELIC_ELECTRON_SMOKE_REPORT_PATH: path.join(os.tmpdir(), "report.json")
    })).toThrow("must be set together");

    expect(() => resolveElectronSmokeConfig({
      RELIC_ELECTRON_SMOKE_KIND: "package",
      RELIC_ELECTRON_SMOKE_REPORT_PATH: "report.json",
      RELIC_ELECTRON_SMOKE_USER_DATA_DIR: path.join(os.tmpdir(), "user-data")
    })).toThrow("must be absolute paths");
  });

  it("RendererとPreloadと初期IPCの成功をreportへ記録して終了する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relic-smoke-main-test-"));
    temporaryDirectories.push(root);
    const webContents = Object.assign(new EventEmitter(), {
      executeJavaScript: vi.fn().mockResolvedValue({
        initialWorkspaceIsEmpty: true,
        mainWindowCreated: true,
        preloadApiAvailable: true,
        rendererLoaded: true,
        workspaceIpcConnected: true
      })
    });
    const app = { exit: vi.fn(), quit: vi.fn() };
    const config = {
      kind: "development" as const,
      reportPath: path.join(root, "report.json"),
      userDataPath: path.join(root, "user-data")
    };

    attachElectronSmoke(app, { webContents } as unknown as BrowserWindow, config);
    webContents.emit("did-finish-load");

    await vi.waitFor(() => expect(app.quit).toHaveBeenCalledOnce());
    expect(app.exit).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(config.reportPath, "utf8"))).toMatchObject({
      checks: { workspaceIpcConnected: true },
      diagnostics: [],
      kind: "development",
      status: "passed"
    });
  });

  it("Rendererの読込失敗をreportへ記録して失敗終了する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relic-smoke-main-test-"));
    temporaryDirectories.push(root);
    const webContents = Object.assign(new EventEmitter(), { executeJavaScript: vi.fn() });
    const app = { exit: vi.fn(), quit: vi.fn() };
    const config = {
      kind: "package" as const,
      reportPath: path.join(root, "report.json"),
      userDataPath: path.join(root, "user-data")
    };

    attachElectronSmoke(app, { webContents } as unknown as BrowserWindow, config);
    webContents.emit("did-fail-load", {}, -2, "load failed");

    await vi.waitFor(() => expect(app.exit).toHaveBeenCalledWith(1));
    expect(app.quit).not.toHaveBeenCalled();
    expect(JSON.parse(await readFile(config.reportPath, "utf8"))).toMatchObject({
      diagnostics: ["Renderer failed to load (-2): load failed"],
      kind: "package",
      status: "failed"
    });
  });
});
