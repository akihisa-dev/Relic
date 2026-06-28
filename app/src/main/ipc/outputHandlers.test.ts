import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  browserWindowOptions: [] as Electron.BrowserWindowConstructorOptions[],
  browserWindowOn: vi.fn(),
  clipboardWriteText: vi.fn(),
  destroy: vi.fn(),
  getPath: vi.fn(),
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
    on = electronMock.browserWindowOn;
    show = electronMock.show;
  }

  return {
    app: { getPath: electronMock.getPath },
    BrowserWindow,
    clipboard: { writeText: electronMock.clipboardWriteText },
    dialog: { showSaveDialog: electronMock.showSaveDialog },
    ipcMain: { handle: electronMock.handle }
  };
});

const fsMock = vi.hoisted(() => ({
  mkdir: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock("node:fs/promises", () => ({
  default: { mkdir: fsMock.mkdir, rename: fsMock.rename, rm: fsMock.rm, unlink: fsMock.unlink, writeFile: fsMock.writeFile },
  mkdir: fsMock.mkdir,
  rename: fsMock.rename,
  rm: fsMock.rm,
  unlink: fsMock.unlink,
  writeFile: fsMock.writeFile
}));

vi.mock("../i18n", async () => {
  const { createTranslator } = await vi.importActual<typeof import("../../shared/i18n")>("../../shared/i18n");

  return {
    getMainTranslator: async () => createTranslator("ja")
  };
});

import {
  copyDiagramSvgChannel,
  printHtmlChannel,
  printPreviewChannel,
  saveDiagramSvgChannel,
  previewOutputHtmlMaxBytes,
  savePreviewAsPdfChannel
} from "../../shared/ipc";
import { registerOutputHandlers } from "./outputHandlers";

const printPreviewDirectoryName = `/tmp/relic-print-preview-${process.pid}`;
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handlerFor(channel: string) {
  const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
  if (!handler) throw new Error(`Handler not registered: ${channel}`);
  return handler as (event: { sender: unknown }, input: unknown) => Promise<unknown>;
}

function loadedHtmlAt(index: number): string {
  const url = electronMock.loadURL.mock.calls.at(index)?.[0] as string | undefined;
  if (!url?.startsWith("data:text/html;base64,")) throw new Error("HTML was not loaded");
  return Buffer.from(url.replace("data:text/html;base64,", ""), "base64").toString("utf8");
}

function validOutputHtml(body = "本文"): string {
  return [
    "<!doctype html>",
    '<html lang="ja">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:;">',
    "<title>Note</title>",
    "</head>",
    "<body>",
    `<main class="relic-output-body">${body}</main>`,
    "</body>",
    "</html>"
  ].join("");
}

function lastWrittenText(): string {
  const value = fsMock.writeFile.mock.calls.at(-1)?.[1];
  if (typeof value !== "string") throw new Error("Text was not written");
  return value;
}

describe("outputHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.browserWindowOptions.length = 0;
    electronMock.getPath.mockReturnValue("/tmp");
    electronMock.isDestroyed.mockReturnValue(false);
    electronMock.loadURL.mockResolvedValue(undefined);
    electronMock.print.mockImplementation((_options: unknown, callback: (success: boolean, failureReason?: string) => void) => callback(true));
    electronMock.printToPDF.mockResolvedValue(Buffer.from("pdf"));
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.rename.mockResolvedValue(undefined);
    fsMock.rm.mockResolvedValue(undefined);
    fsMock.unlink.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
  });

  it("PDF保存キャンセル時はエラー扱いせず書き込まない", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: validOutputHtml(),
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
      html: validOutputHtml(),
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "canceled" } });
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("PDF保存失敗時は秘密情報を伏せ字にしてエラーを返す", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/out.pdf" });
    electronMock.printToPDF.mockRejectedValue(new Error(`pdf failed SERVICE_API_KEY=${["sk", "secret", "value"].join("-")}`));
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
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
  });

  it("PDF保存時は一時ファイル経由で保存する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/out.pdf" });
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
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
    expect(fsMock.writeFile).not.toHaveBeenCalledWith("/tmp/out.pdf", expect.anything(), expect.anything());
  });

  it("PDF保存でHTMLが空の場合は入力エラーになる", async () => {
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: "",
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PDF_INVALID_INPUT" })
    });
    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("実印刷ではHTMLと印刷オプションをmain側印刷へ渡す", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printHtmlChannel)({ sender: {} }, {
      html: validOutputHtml(),
      printOptions: {
        landscape: true,
        marginType: "custom",
        margins: { bottom: 0.25, left: 0.25, right: 0.25, top: 0.25 },
        pageSize: "A3",
        scaleFactor: 1.25
      },
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "printed" } });
    expect(electronMock.print).toHaveBeenCalledWith(expect.objectContaining({
      landscape: true,
      pageSize: "A3",
      printBackground: true,
      scaleFactor: 1.25,
      silent: false
    }), expect.any(Function));
    expect(electronMock.destroy).toHaveBeenCalled();
  });

  it("実印刷で危険なHTMLはhidden windowを作らない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printHtmlChannel)({ sender: {} }, {
      html: validOutputHtml("<script>alert(1)</script>"),
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PRINT_INVALID_INPUT" })
    });
    expect(electronMock.print).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("PDF保存でHTMLサイズ上限を超えると入力エラーになり、hidden windowを作らない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: "a".repeat(previewOutputHtmlMaxBytes + 1),
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PDF_INVALID_INPUT" })
    });
    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("PDF保存でCSPのないHTMLは入力エラーになり、hidden windowを作らない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: "<!doctype html><html><head><title>Note</title></head><body><main class=\"relic-output-body\">本文</main></body></html>",
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PDF_INVALID_INPUT" })
    });
    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("出力HTMLの必須構造がない場合は入力エラーになる", async () => {
    registerOutputHandlers();

    const invalidHtmlValues = [
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><main class="relic-output-body">本文</main></body></html>',
      '<!doctype html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><main class="relic-output-body">本文</main></body>',
      '<!doctype html><html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><body><main class="relic-output-body">本文</main></body></html>',
      '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><div>本文</div></body></html>'
    ];

    for (const html of invalidHtmlValues) {
      const result = await handlerFor(printHtmlChannel)({ sender: {} }, { html, title: "Note" });

      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "OUTPUT_PRINT_INVALID_INPUT" })
      });
    }
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("PDF保存で許可外タグや危険属性を含むHTMLは入力エラーになる", async () => {
    registerOutputHandlers();

    const result = await handlerFor(savePreviewAsPdfChannel)({ sender: {} }, {
      defaultFileName: "Note",
      html: validOutputHtml('<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">link</a><meta http-equiv = "refresh" content="0;url=https://example.com"><span style="background:url(https://example.com/a.png)">x</span>'),
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PDF_INVALID_INPUT" })
    });
    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("出力用ウィンドウはPDF/印刷HTMLでインラインスクリプトを無効化する", async () => {
    registerOutputHandlers();

    await handlerFor(printHtmlChannel)({ sender: {} }, {
      html: validOutputHtml(),
      title: "Note"
    });

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

  it("SVG保存時は一時ファイル経由で保存する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });
    registerOutputHandlers();

    const result = await handlerFor(saveDiagramSvgChannel)({ sender: {} }, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: '<svg><path d="M0 0" /></svg>'
    });

    expect(result).toEqual({ ok: true, value: { filePath: "/tmp/diagram.svg", status: "saved" } });
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/tmp\/\.diagram\.svg\..+\.tmp$/),
      expect.any(String),
      "utf8"
    );
    expect(lastWrittenText()).toContain('<path d="M0 0"');
    expect(fsMock.rename).toHaveBeenCalledWith(
      expect.stringMatching(/\/tmp\/\.diagram\.svg\..+\.tmp$/),
      "/tmp/diagram.svg"
    );
    expect(fsMock.writeFile).not.toHaveBeenCalledWith("/tmp/diagram.svg", expect.anything(), expect.anything());
  });

  it("SVG保存前にmain側でも危険なSVG要素を除去する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });
    registerOutputHandlers();

    const result = await handlerFor(saveDiagramSvgChannel)({ sender: {} }, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: '<svg><script>alert(1)</script><path onclick="alert(1)" href="javascript:alert(1)" d="M0 0" /></svg>'
    });

    expect(result).toEqual({ ok: true, value: { filePath: "/tmp/diagram.svg", status: "saved" } });
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\/tmp\/\.diagram\.svg\..+\.tmp$/),
      expect.any(String),
      "utf8"
    );
    expect(lastWrittenText()).toContain('<path d="M0 0"');
    expect(lastWrittenText()).not.toContain("<script");
    expect(lastWrittenText()).not.toContain("onclick");
    expect(lastWrittenText()).not.toContain("javascript:");
  });

  it("SVG保存前にmain側で大文字小文字混在や空白入りの危険なSVG属性を除去する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });
    registerOutputHandlers();

    const result = await handlerFor(saveDiagramSvgChannel)({ sender: {} }, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: '<svg onLoad="alert(1)"><SCRIPT>alert(1)</SCRIPT><text ONCLICK="alert(1)">safe</text><a href="java\nscript:alert(1)" xlink:href="file:///tmp/a.svg">link</a></svg>'
    });

    expect(result).toEqual({ ok: true, value: { filePath: "/tmp/diagram.svg", status: "saved" } });
    expect(lastWrittenText()).toContain("<text>safe</text>");
    expect(lastWrittenText()).toContain("<a>link</a>");
    expect(lastWrittenText()).not.toMatch(/<script/i);
    expect(lastWrittenText()).not.toMatch(/\son/i);
    expect(lastWrittenText()).not.toContain("javascript:");
    expect(lastWrittenText()).not.toContain("file:");
  });

  it("SVG保存の初期ファイル名がドットだけの場合はSVG用の既定名へ戻す", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });
    registerOutputHandlers();

    const result = await handlerFor(saveDiagramSvgChannel)({ sender: {} }, {
      defaultFileName: ".",
      language: "d2",
      svg: '<svg><path d="M0 0" /></svg>'
    });

    expect(result).toEqual({ ok: true, value: { status: "canceled" } });
    expect(electronMock.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: "relic-diagram.svg"
    }));
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

  it("SVGコピー前にmain側でも危険なSVG要素を除去する", async () => {
    registerOutputHandlers();

    const result = await handlerFor(copyDiagramSvgChannel)({ sender: {} }, {
      language: "d2",
      svg: "<svg><foreignObject><div>unsafe</div></foreignObject><text onload=\"alert(1)\">safe</text><a href=javascript:alert(1)>link</a></svg>"
    });

    expect(result).toEqual({ ok: true, value: { status: "copied" } });
    expect(electronMock.clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("<text>safe</text>"));
    expect(electronMock.clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining("<a>link</a>"));
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalledWith(expect.stringContaining("<foreignObject"));
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalledWith(expect.stringContaining("onload"));
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalledWith(expect.stringContaining("javascript:"));
  });

  it("印刷時は一時PDFをChromiumのPDFプレビューとして開く", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printPreviewChannel)({ sender: {} }, {
      html: validOutputHtml(),
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "printed" } });
    expect(electronMock.printToPDF).toHaveBeenCalledWith(expect.not.objectContaining({
      margins: expect.anything()
    }));
    expect(electronMock.show).toHaveBeenCalled();
    expect(electronMock.focus).toHaveBeenCalled();
    expect(electronMock.print).not.toHaveBeenCalled();
    expect(electronMock.browserWindowOn).toHaveBeenCalledWith("closed", expect.any(Function));
    expect(fsMock.rm).toHaveBeenCalledWith(printPreviewDirectoryName, { force: true, recursive: true });
    expect(fsMock.mkdir).toHaveBeenCalledWith(printPreviewDirectoryName, { recursive: true });
    expect(fsMock.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`${escapeRegExp(printPreviewDirectoryName)}\\/\\.preview-.+\\.pdf\\..+\\.tmp$`)),
      Buffer.from("pdf"),
      undefined
    );
    expect(fsMock.rename).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`${escapeRegExp(printPreviewDirectoryName)}\\/\\.preview-.+\\.pdf\\..+\\.tmp$`)),
      expect.stringMatching(new RegExp(`${escapeRegExp(printPreviewDirectoryName)}\\/preview-.+\\.pdf$`))
    );
    expect(electronMock.loadURL.mock.calls.at(-1)?.[0]).toMatch(new RegExp(`^file:\\/\\/\\/tmp\\/relic-print-preview-${process.pid}\\/preview-.+\\.pdf$`));
    expect(electronMock.loadURL.mock.calls.at(-1)?.[0]).not.toContain("Note");
    expect(electronMock.browserWindowOptions.at(-1)?.webPreferences).toEqual(
      expect.objectContaining({
        contextIsolation: true,
        javascript: true,
        nodeIntegration: false,
        partition: "relic-output",
        sandbox: true
      })
    );

    const printPreviewNavigationHandler = electronMock.webContentsOn.mock.calls
      .filter(([eventName]) => eventName === "will-navigate")
      .at(-1)?.[1] as ((event: { preventDefault: () => void }, url: string) => void) | undefined;
    const pdfUrl = electronMock.loadURL.mock.calls.at(-1)?.[0] as string;
    const allowedNavigation = { preventDefault: vi.fn() };
    const blockedNavigation = { preventDefault: vi.fn() };
    printPreviewNavigationHandler?.(allowedNavigation, pdfUrl);
    printPreviewNavigationHandler?.(blockedNavigation, "data:text/html,<script>alert(1)</script>");
    expect(allowedNavigation.preventDefault).not.toHaveBeenCalled();
    expect(blockedNavigation.preventDefault).toHaveBeenCalled();

    const html = loadedHtmlAt(0);
    expect(html).toContain("本文");

    const closeHandler = electronMock.browserWindowOn.mock.calls.find(([eventName]) => eventName === "closed")?.[1] as (() => void) | undefined;
    closeHandler?.();
    expect(fsMock.unlink).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${escapeRegExp(printPreviewDirectoryName)}\\/preview-.+\\.pdf$`)));
  });

  it("印刷プレビューで検証済み用紙設定をprintToPDFへ渡す", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printPreviewChannel)({ sender: {} }, {
      html: validOutputHtml(),
      printOptions: {
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
      },
      title: "Note"
    });

    expect(result).toEqual({ ok: true, value: { status: "printed" } });
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

  it("印刷プレビューでHTMLが空の場合は入力エラーになる", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printPreviewChannel)({ sender: {} }, {
      html: "",
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PRINT_INVALID_INPUT" })
    });
    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("印刷プレビューでHTMLサイズ上限を超えると入力エラーになり、hidden windowを作らない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printPreviewChannel)({ sender: {} }, {
      html: "a".repeat(previewOutputHtmlMaxBytes + 1),
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PRINT_INVALID_INPUT" })
    });
    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("印刷プレビューでCSPのないHTMLは入力エラーになり、hidden windowを作らない", async () => {
    registerOutputHandlers();

    const result = await handlerFor(printPreviewChannel)({ sender: {} }, {
      html: "<!doctype html><html><head><title>Note</title></head><body><main class=\"relic-output-body\">本文</main></body></html>",
      title: "Note"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_PRINT_INVALID_INPUT" })
    });
    expect(electronMock.printToPDF).not.toHaveBeenCalled();
    expect(electronMock.loadURL).not.toHaveBeenCalled();
  });

  it("印刷プレビュー起動時の古い一時PDF削除に失敗してもハンドラ登録を続ける", async () => {
    fsMock.rm.mockRejectedValue(new Error("cleanup failed"));

    expect(() => registerOutputHandlers()).not.toThrow();

    expect(fsMock.rm).toHaveBeenCalledWith(printPreviewDirectoryName, { force: true, recursive: true });
    expect(electronMock.handle).toHaveBeenCalledWith(printPreviewChannel, expect.any(Function));
  });
});
