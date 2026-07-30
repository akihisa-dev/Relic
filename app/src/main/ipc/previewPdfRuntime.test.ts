import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  browserWindowOptions: [] as Electron.BrowserWindowConstructorOptions[],
  browserWindowOnce: vi.fn(),
  browserWindowRemoveListener: vi.fn(),
  destroy: vi.fn(),
  isDestroyed: vi.fn(),
  loadURL: vi.fn(),
  printToPDF: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
  setWindowOpenHandler: vi.fn(),
  webContentsOn: vi.fn(),
  webContentsRemoveListener: vi.fn()
}));

vi.mock("electron", () => {
  class BrowserWindow {
    constructor(options: Electron.BrowserWindowConstructorOptions) {
      electronMock.browserWindowOptions.push(options);
    }

    webContents = {
      on: electronMock.webContentsOn,
      printToPDF: electronMock.printToPDF,
      removeListener: electronMock.webContentsRemoveListener,
      session: { setPermissionRequestHandler: electronMock.setPermissionRequestHandler },
      setWindowOpenHandler: electronMock.setWindowOpenHandler
    };

    destroy = electronMock.destroy;
    isDestroyed = electronMock.isDestroyed;
    loadURL = electronMock.loadURL;
    once = electronMock.browserWindowOnce;
    removeListener = electronMock.browserWindowRemoveListener;
  }

  return { BrowserWindow };
});

import { renderPreviewHtmlToPdf } from "./previewPdfRuntime";
import { validOutputHtml } from "./outputHandlersTestHelpers";

describe("renderPreviewHtmlToPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.browserWindowOptions.length = 0;
    electronMock.isDestroyed.mockReturnValue(false);
    electronMock.loadURL.mockResolvedValue(undefined);
    electronMock.printToPDF.mockResolvedValue(Buffer.from("pdf"));
  });

  it("HTMLの読み込み失敗時もウィンドウとセキュリティlistenerを片付ける", async () => {
    electronMock.loadURL.mockRejectedValue(new Error("load failed"));

    await expect(
      renderPreviewHtmlToPdf(validOutputHtml(), "Note")
    ).rejects.toThrow("load failed");

    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(electronMock.webContentsRemoveListener).toHaveBeenCalledTimes(2);
    expect(electronMock.browserWindowRemoveListener).toHaveBeenCalledWith(
      "closed",
      expect.any(Function)
    );
    expect(electronMock.destroy).toHaveBeenCalledTimes(1);
  });

  it("検証済み用紙設定をprintToPDFへ渡す", async () => {
    const result = await renderPreviewHtmlToPdf(validOutputHtml(), "Note", {
      landscape: true,
      marginType: "custom",
      margins: {
        bottom: 0.236,
        left: 0.236,
        right: 0.236,
        top: 0.236
      },
      pageSize: "A3",
      scaleFactor: 1.25
    });

    expect(result).toEqual(Buffer.from("pdf"));
    expect(electronMock.printToPDF).toHaveBeenCalledWith(expect.objectContaining({
      landscape: true,
      margins: {
        bottom: 0.236,
        left: 0.236,
        marginType: "custom",
        right: 0.236,
        top: 0.236
      },
      pageSize: "A3",
      scaleFactor: 1.25
    }));
  });

  it("PDF出力用ウィンドウはインラインスクリプトを無効化する", async () => {
    await renderPreviewHtmlToPdf(validOutputHtml(), "Note");

    expect(electronMock.browserWindowOptions.at(-1)?.webPreferences).toEqual(
      expect.objectContaining({
        allowRunningInsecureContent: false,
        contextIsolation: true,
        javascript: false,
        nodeIntegration: false,
        partition: "relic-output",
        sandbox: true,
        webSecurity: true
      })
    );
    expect(electronMock.setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
    expect(electronMock.setPermissionRequestHandler).toHaveBeenCalledWith(expect.any(Function));
  });

  it("新規ウィンドウ、許可外ナビゲーション、webview、権限要求を拒否する", async () => {
    await renderPreviewHtmlToPdf(validOutputHtml(), "Note");

    const openHandler = electronMock.setWindowOpenHandler.mock.calls.at(-1)?.[0];
    expect(openHandler?.({ url: "https://example.com" })).toEqual({ action: "deny" });

    const navigateHandler = electronMock.webContentsOn.mock.calls
      .filter(([channel]) => channel === "will-navigate")
      .at(-1)?.[1];
    const blockedNavigation = { preventDefault: vi.fn() };
    navigateHandler?.(blockedNavigation, "https://example.com");
    expect(blockedNavigation.preventDefault).toHaveBeenCalled();

    const dataNavigation = { preventDefault: vi.fn() };
    navigateHandler?.(dataNavigation, "data:text/html;base64,PGh0bWw+PC9odG1sPg==");
    expect(dataNavigation.preventDefault).not.toHaveBeenCalled();

    const attachWebviewHandler = electronMock.webContentsOn.mock.calls
      .filter(([channel]) => channel === "will-attach-webview")
      .at(-1)?.[1];
    const attachWebviewEvent = { preventDefault: vi.fn() };
    attachWebviewHandler?.(attachWebviewEvent);
    expect(attachWebviewEvent.preventDefault).toHaveBeenCalled();

    const permissionHandler = electronMock.setPermissionRequestHandler.mock.calls.at(-1)?.[0];
    const permissionCallback = vi.fn();
    permissionHandler?.({}, "notifications", permissionCallback);
    expect(permissionCallback).toHaveBeenCalledWith(false);
  });
});
