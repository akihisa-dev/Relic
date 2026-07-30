import { createTranslator, type Translator } from "../../shared/i18n";
import type { AppSettingsRecoveryState } from "./appSettingsRecovery";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  browserWindowOptions: [] as Electron.BrowserWindowConstructorOptions[],
  listeners: new Map<string, (...args: unknown[]) => void>(),
  loadURL: vi.fn().mockResolvedValue(undefined),
  permissionHandler: vi.fn(),
  setWindowOpenHandler: vi.fn(),
  show: vi.fn(),
  webContentsRemoveListener: vi.fn(),
  windowRemoveListener: vi.fn()
}));

vi.mock("electron", () => ({
  BrowserWindow: class BrowserWindow {
    webContents = {
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        electronMock.listeners.set(event, listener);
      }),
      removeListener: electronMock.webContentsRemoveListener,
      session: {
        setPermissionRequestHandler: electronMock.permissionHandler
      },
      setWindowOpenHandler: electronMock.setWindowOpenHandler
    };

    constructor(options: Electron.BrowserWindowConstructorOptions) {
      electronMock.browserWindowOptions.push(options);
    }

    isDestroyed = vi.fn(() => false);
    loadURL = electronMock.loadURL;
    once = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      electronMock.listeners.set(event, listener);
    });
    removeListener = electronMock.windowRemoveListener;
    show = electronMock.show;
  }
}));

import {
  createAppSettingsRecoveryHtml,
  createAppSettingsRecoveryWindow
} from "./appSettingsRecoveryWindow";

describe("appSettingsRecoveryWindow", () => {
  const t = ((key) => key) as Translator;

  beforeEach(() => {
    electronMock.browserWindowOptions.length = 0;
    electronMock.listeners.clear();
    electronMock.loadURL.mockClear();
    electronMock.permissionHandler.mockClear();
    electronMock.setWindowOpenHandler.mockClear();
    electronMock.show.mockClear();
    electronMock.webContentsRemoveListener.mockClear();
    electronMock.windowRemoveListener.mockClear();
  });

  it("スクリプトと権限を無効にした専用ウィンドウへ復旧画面を読み込む", () => {
    createAppSettingsRecoveryWindow({
      onExit: vi.fn(),
      onShowLocation: vi.fn(),
      onStartDefaults: vi.fn().mockResolvedValue(undefined),
      onStartDefaultsFailed: vi.fn(),
      recovery: recoveryState("corrupt"),
      t
    });

    expect(electronMock.browserWindowOptions).toHaveLength(1);
    expect(electronMock.browserWindowOptions[0]?.webPreferences).toMatchObject({
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    });
    expect(electronMock.loadURL).toHaveBeenCalledWith(expect.stringMatching(/^data:text\/html;base64,/));
    expect(electronMock.permissionHandler).toHaveBeenCalledOnce();
    expect(electronMock.setWindowOpenHandler).toHaveBeenCalledOnce();
  });

  it("理由・設定場所・バックアップ場所と3つの復旧操作を表示する", () => {
    const html = createAppSettingsRecoveryHtml(recoveryState("corrupt"), t);

    expect(html).toContain("settingsRecovery.corruptReason");
    expect(html).toContain("/user-data/app-settings.json");
    expect(html).toContain("/user-data/app-settings.corrupt-1.json");
    expect(html).toContain("relic-settings-recovery://start-defaults");
    expect(html).toContain("relic-settings-recovery://show-location");
    expect(html).toContain("relic-settings-recovery://exit");
    expect(html).toContain("default-src 'none'");
  });

  it("非対応形式ではバックアップ未作成のまま元設定を変更していない説明を出す", () => {
    const html = createAppSettingsRecoveryHtml(recoveryState("unsupported"), t);

    expect(html).toContain("settingsRecovery.unsupportedReason");
    expect(html).toContain("settingsRecovery.unsupportedPreservation");
    expect(html).not.toContain("settingsRecovery.backupLocation");
  });

  it("保存設定を読めない場合もOSの表示言語で復旧画面を作れる", () => {
    const japanese = createAppSettingsRecoveryHtml(
      recoveryState("corrupt"),
      createTranslator("system", "ja-JP")
    );
    const english = createAppSettingsRecoveryHtml(
      recoveryState("corrupt"),
      createTranslator("system", "en-US")
    );

    expect(japanese).toContain("アプリ設定を読み込めませんでした");
    expect(english).toContain("Relic could not read the app settings");
  });

  it("復旧リンク以外の画面遷移を止め、場所表示・終了・初期設定起動だけを委譲する async", async () => {
    const onExit = vi.fn();
    const onShowLocation = vi.fn();
    const onStartDefaults = vi.fn().mockResolvedValue(undefined);
    createAppSettingsRecoveryWindow({
      onExit,
      onShowLocation,
      onStartDefaults,
      onStartDefaultsFailed: vi.fn(),
      recovery: recoveryState("corrupt"),
      t
    });
    const navigate = electronMock.listeners.get("will-navigate");
    const event = { preventDefault: vi.fn() };
    const dataNavigation = { preventDefault: vi.fn() };

    navigate?.(dataNavigation, "data:text/html;base64,PGh0bWw+PC9odG1sPg==");
    navigate?.(event, "https://invalid.example/");
    navigate?.(event, "relic-settings-recovery://show-location");
    navigate?.(event, "relic-settings-recovery://exit");
    navigate?.(event, "relic-settings-recovery://start-defaults");
    await Promise.resolve();

    expect(dataNavigation.preventDefault).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(4);
    expect(onShowLocation).toHaveBeenCalledWith("/user-data/app-settings.corrupt-1.json");
    expect(onExit).toHaveBeenCalledOnce();
    expect(onStartDefaults).toHaveBeenCalledOnce();
  });

  function recoveryState(kind: AppSettingsRecoveryState["kind"]): AppSettingsRecoveryState {
    return {
      backupPath: kind === "corrupt" ? "/user-data/app-settings.corrupt-1.json" : null,
      kind,
      settingsPath: "/user-data/app-settings.json"
    };
  }
});
