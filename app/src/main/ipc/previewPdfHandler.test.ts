import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  browserWindowOptions: [] as Electron.BrowserWindowConstructorOptions[],
  browserWindowOnce: vi.fn(),
  browserWindowRemoveListener: vi.fn(),
  destroy: vi.fn(),
  fromWebContents: vi.fn(),
  isDestroyed: vi.fn(),
  loadURL: vi.fn(),
  printToPDF: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
  setWindowOpenHandler: vi.fn(),
  showSaveDialog: vi.fn(),
  webContentsOn: vi.fn(),
  webContentsRemoveListener: vi.fn()
}));

vi.mock("electron", () => {
  class BrowserWindow {
    static fromWebContents = electronMock.fromWebContents;

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

  return {
    BrowserWindow,
    dialog: { showSaveDialog: electronMock.showSaveDialog }
  };
});

const fsMock = vi.hoisted(() => ({
  open: vi.fn(),
  rename: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock("node:fs/promises", () => ({
  default: fsMock,
  ...fsMock
}));

vi.mock("../i18n", async () => {
  const { createTranslator } = await vi.importActual<typeof import("../../shared/i18n")>("../../shared/i18n");

  return {
    getMainTranslator: async () => createTranslator("ja")
  };
});

import { savePreviewAsPdf } from "./previewPdfHandler";
import { validOutputHtml } from "./outputHandlersTestHelpers";

const event = { sender: {} } as Electron.IpcMainInvokeEvent;

describe("savePreviewAsPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.browserWindowOptions.length = 0;
    electronMock.fromWebContents.mockReturnValue(null);
    electronMock.isDestroyed.mockReturnValue(false);
    electronMock.loadURL.mockResolvedValue(undefined);
    electronMock.printToPDF.mockResolvedValue(Buffer.from("pdf"));
    fsMock.rename.mockResolvedValue(undefined);
    fsMock.stat.mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOENT" }));
    fsMock.unlink.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
  });

  it("PDF保存がキャンセルされた場合と保存先未指定の場合は書き込まない", async () => {
    electronMock.showSaveDialog
      .mockResolvedValueOnce({ canceled: true, filePath: "" })
      .mockResolvedValueOnce({ canceled: false, filePath: "" });
    const input = {
      defaultFileName: "Note",
      html: validOutputHtml(),
      title: "Note"
    };

    const canceledResult = await savePreviewAsPdf(event, input);
    const missingPathResult = await savePreviewAsPdf(event, input);

    expect(canceledResult).toEqual({ ok: true, value: { status: "canceled" } });
    expect(missingPathResult).toEqual({ ok: true, value: { status: "canceled" } });
    expect(fsMock.writeFile).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("PDF生成・読み込みの失敗時は安全化したエラーを返す", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/out.pdf" });
    electronMock.printToPDF.mockRejectedValue(
      new Error(`pdf failed SERVICE_API_KEY=${["sk", "secret", "value"].join("-")}`)
    );

    const result = await savePreviewAsPdf(event, {
      defaultFileName: "Note",
      html: validOutputHtml(),
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "OUTPUT_PDF_FAILED",
        details: "pdf failed SERVICE_API_KEY=[redacted]"
      })
    });
    expect(electronMock.destroy).toHaveBeenCalled();

    vi.clearAllMocks();
    electronMock.fromWebContents.mockReturnValue(null);
    electronMock.isDestroyed.mockReturnValue(false);
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/out.pdf" });
    electronMock.loadURL.mockRejectedValue(new Error("load failed"));
    electronMock.printToPDF.mockResolvedValue(Buffer.from("pdf"));

    const loadFailureResult = await savePreviewAsPdf(event, {
      defaultFileName: "Note",
      html: validOutputHtml(),
      title: "Note"
    });

    expect(loadFailureResult).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "OUTPUT_PDF_FAILED",
        details: "load failed"
      })
    });
    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
    expect(electronMock.webContentsRemoveListener).toHaveBeenCalledTimes(3);
    expect(electronMock.browserWindowRemoveListener).toHaveBeenCalledWith(
      "closed",
      expect.any(Function)
    );
    expect(electronMock.destroy).toHaveBeenCalledTimes(1);
  });

  it("PDF保存時は一時ファイル経由で保存し実行環境を片付ける", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/out.pdf" });

    const result = await savePreviewAsPdf(event, {
      defaultFileName: "Note",
      html: validOutputHtml(),
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { filePath: "/tmp/out.pdf", status: "saved" } });
    expect(electronMock.printToPDF).toHaveBeenCalledWith(expect.not.objectContaining({
      margins: expect.anything()
    }));
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/tmp\/\.out\.pdf\..+\.tmp$/),
      Buffer.from("pdf"),
      undefined
    );
    expect(fsMock.rename).toHaveBeenCalledWith(
      expect.stringMatching(/\/tmp\/\.out\.pdf\..+\.tmp$/),
      "/tmp/out.pdf"
    );
    expect(fsMock.writeFile).not.toHaveBeenCalledWith(
      "/tmp/out.pdf",
      expect.anything(),
      expect.anything()
    );
    expect(electronMock.webContentsRemoveListener).toHaveBeenCalledWith(
      "will-navigate",
      expect.any(Function)
    );
    expect(electronMock.webContentsRemoveListener).toHaveBeenCalledWith(
      "will-redirect",
      expect.any(Function)
    );
    expect(electronMock.webContentsRemoveListener).toHaveBeenCalledWith(
      "will-attach-webview",
      expect.any(Function)
    );
    expect(electronMock.browserWindowRemoveListener).toHaveBeenCalledWith(
      "closed",
      expect.any(Function)
    );
    expect(electronMock.destroy).toHaveBeenCalledTimes(1);
  });

  it("PDF保存ダイアログは送信元ウィンドウを親にし、名前と拡張子を補正する", async () => {
    const parentWindow = { id: "parent" };
    electronMock.fromWebContents.mockReturnValue(parentWindow);
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });

    const result = await savePreviewAsPdf(event, {
      defaultFileName: "Folder/Note",
      html: validOutputHtml(),
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "canceled" } });
    expect(electronMock.showSaveDialog).toHaveBeenCalledWith(
      parentWindow,
      expect.objectContaining({
        defaultPath: "Folder_Note.pdf",
        filters: [{ extensions: ["pdf"], name: "PDF" }],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      })
    );
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });
});
