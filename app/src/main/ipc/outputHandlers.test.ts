import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  browserWindowOptions: [] as Electron.BrowserWindowConstructorOptions[],
  clipboardWriteText: vi.fn(),
  destroy: vi.fn(),
  handle: vi.fn(),
  isDestroyed: vi.fn(),
  focus: vi.fn(),
  loadURL: vi.fn(),
  print: vi.fn(),
  printToPDF: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
  setWindowOpenHandler: vi.fn(),
  show: vi.fn(),
  showSaveDialog: vi.fn(),
  webContentsOn: vi.fn()
}));

vi.mock("electron", () => {
  class BrowserWindow {
    static fromWebContents = vi.fn().mockReturnValue(null);

    constructor(options: Electron.BrowserWindowConstructorOptions) {
      electronMock.browserWindowOptions.push(options);
    }

    webContents = {
      on: electronMock.webContentsOn,
      print: electronMock.print,
      printToPDF: electronMock.printToPDF,
      session: { setPermissionRequestHandler: electronMock.setPermissionRequestHandler },
      setWindowOpenHandler: electronMock.setWindowOpenHandler
    };

    destroy = electronMock.destroy;
    focus = electronMock.focus;
    isDestroyed = electronMock.isDestroyed;
    loadURL = electronMock.loadURL;
    show = electronMock.show;
  }

  return {
    BrowserWindow,
    clipboard: { writeText: electronMock.clipboardWriteText },
    dialog: { showSaveDialog: electronMock.showSaveDialog },
    ipcMain: { handle: electronMock.handle }
  };
});

const fsMock = vi.hoisted(() => ({
  writeFile: vi.fn()
}));

vi.mock("node:fs/promises", () => ({
  default: { writeFile: fsMock.writeFile },
  writeFile: fsMock.writeFile
}));

import {
  copyDiagramSvgChannel,
  printPreviewChannel,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel
} from "../../shared/ipc";
import { registerOutputHandlers } from "./outputHandlers";

function handlerFor(channel: string) {
  const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
  if (!handler) throw new Error(`Handler not registered: ${channel}`);
  return handler as (event: { sender: unknown }, input: unknown) => Promise<unknown>;
}

function lastLoadedHtml(): string {
  const url = electronMock.loadURL.mock.calls.at(-1)?.[0] as string | undefined;
  if (!url?.startsWith("data:text/html;base64,")) throw new Error("HTML was not loaded");
  return Buffer.from(url.replace("data:text/html;base64,", ""), "base64").toString("utf8");
}

describe("outputHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.browserWindowOptions.length = 0;
    electronMock.isDestroyed.mockReturnValue(false);
    electronMock.loadURL.mockResolvedValue(undefined);
    electronMock.printToPDF.mockResolvedValue(Buffer.from("pdf"));
    fsMock.writeFile.mockResolvedValue(undefined);
  });

  it("PDF保存キャンセル時はエラー扱いせず書き込まない", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: "<html><body>本文</body></html>",
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "canceled" } });
    expect(fsMock.writeFile).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("PDF保存で保存先未指定時は書き込まない", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "" });
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: "<html><body>本文</body></html>",
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "canceled" } });
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("PDF保存失敗時はエラーを返す", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/out.pdf" });
    electronMock.printToPDF.mockRejectedValue(new Error("pdf failed"));
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: "<html><body>本文</body></html>",
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "OUTPUT_PDF_FAILED",
        details: "pdf failed"
      })
    });
    expect(electronMock.destroy).toHaveBeenCalled();
  });

  it("SVG保存で空SVGを保存しない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(saveDiagramSvgChannel)({ sender: {} }, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: "<svg></svg>"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_SVG_EMPTY" })
    });
    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("SVGコピーで空SVGをコピーしない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(copyDiagramSvgChannel)({ sender: {} }, {
      language: "d2",
      svg: "<svg></svg>"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_SVG_EMPTY" })
    });
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("印刷時は印刷用Windowを開きOS標準印刷ボタンを表示する", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printPreviewChannel)({ sender: {} }, {
      html: '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body>本文</body></html>',
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "printed" } });
    expect(electronMock.loadURL).toHaveBeenCalled();
    expect(electronMock.show).toHaveBeenCalled();
    expect(electronMock.focus).toHaveBeenCalled();
    expect(electronMock.print).not.toHaveBeenCalled();
    expect(electronMock.destroy).not.toHaveBeenCalled();
    expect(electronMock.browserWindowOptions.at(-1)?.webPreferences).toEqual(
      expect.objectContaining({
        contextIsolation: true,
        javascript: true,
        nodeIntegration: false,
        sandbox: true
      })
    );

    const html = lastLoadedHtml();
    expect(html).toContain("OS標準の印刷画面を開く");
    expect(html).toContain("window.print()");
    expect(html).toContain("setTimeout(openPrintDialog, 150)");
    expect(html).toContain(".relic-print-preview-toolbar");
    expect(html).toContain("display: none !important");
    expect(html).toContain("script-src 'unsafe-inline'");
  });
});
