import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  clipboardWriteText: vi.fn(),
  fromWebContents: vi.fn(),
  showSaveDialog: vi.fn()
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: electronMock.fromWebContents },
  clipboard: { writeText: electronMock.clipboardWriteText },
  dialog: { showSaveDialog: electronMock.showSaveDialog }
}));

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

import { maxSvgInputBytes } from "../../shared/ipc";
import { copyDiagramSvg, saveDiagramSvg } from "./diagramOutputHandlers";

const event = { sender: {} } as Electron.IpcMainInvokeEvent;

function lastWrittenText(): string {
  const value = fsMock.writeFile.mock.calls.at(-1)?.[1];
  if (typeof value !== "string") throw new Error("Text was not written");
  return value;
}

describe("diagramOutputHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.fromWebContents.mockReturnValue(null);
    fsMock.rename.mockResolvedValue(undefined);
    fsMock.stat.mockRejectedValue(Object.assign(new Error("not found"), { code: "ENOENT" }));
    fsMock.unlink.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
  });

  it("SVG保存で空SVGを保存しない", async () => {
    const result = await saveDiagramSvg(event, {
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

  it("SVG保存で入力サイズ上限を超えると保存処理へ進まない", async () => {
    const result = await saveDiagramSvg(event, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: "x".repeat(maxSvgInputBytes + 1)
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_SVG_INVALID_INPUT" })
    });
    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("SVG保存時は一時ファイル経由で保存する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });

    const result = await saveDiagramSvg(event, {
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
    expect(fsMock.writeFile).not.toHaveBeenCalledWith(
      "/tmp/diagram.svg",
      expect.anything(),
      expect.anything()
    );
  });

  it("SVG保存失敗時は一時保存を完了扱いにせず、安全化したエラーを返す", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });
    fsMock.writeFile.mockRejectedValue(
      new Error(`write failed SERVICE_API_KEY=${["sk", "secret", "value"].join("-")}`)
    );

    const result = await saveDiagramSvg(event, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: '<svg><path d="M0 0" /></svg>'
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "OUTPUT_SVG_SAVE_FAILED",
        details: "write failed SERVICE_API_KEY=[redacted]"
      })
    });
    expect(fsMock.rename).not.toHaveBeenCalled();
  });

  it("SVG保存前にmain側でも危険なSVG要素を除去する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });

    const result = await saveDiagramSvg(event, {
      defaultFileName: "Note-diagram-1-mermaid",
      language: "mermaid",
      svg: '<svg><script>alert(1)</script><path onclick="alert(1)" href="javascript:alert(1)" d="M0 0" /></svg>'
    });

    expect(result).toEqual({ ok: true, value: { filePath: "/tmp/diagram.svg", status: "saved" } });
    expect(lastWrittenText()).toContain('<path d="M0 0"');
    expect(lastWrittenText()).not.toContain("<script");
    expect(lastWrittenText()).not.toContain("onclick");
    expect(lastWrittenText()).not.toContain("javascript:");
  });

  it("SVG保存前に大文字小文字混在や空白入りの危険なSVG属性を除去する", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: "/tmp/diagram.svg" });

    const result = await saveDiagramSvg(event, {
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

  it("SVG保存の初期ファイル名がドットだけの場合は既定名へ戻す", async () => {
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });

    const result = await saveDiagramSvg(event, {
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

  it("SVG保存ダイアログは送信元ウィンドウを親にし、拡張子を重複させない", async () => {
    const parentWindow = { id: "parent" };
    electronMock.fromWebContents.mockReturnValue(parentWindow);
    electronMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: "" });

    const result = await saveDiagramSvg(event, {
      defaultFileName: "Diagram.SVG",
      language: "d2",
      svg: '<svg><path d="M0 0" /></svg>'
    });

    expect(result).toEqual({ ok: true, value: { status: "canceled" } });
    expect(electronMock.showSaveDialog).toHaveBeenCalledWith(
      parentWindow,
      expect.objectContaining({
        defaultPath: "Diagram.SVG",
        filters: [{ extensions: ["svg"], name: "SVG" }],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      })
    );
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("SVGコピーで空SVGをコピーしない", async () => {
    const result = await copyDiagramSvg(event, {
      language: "d2",
      svg: "<svg></svg>"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_SVG_EMPTY" })
    });
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("SVGコピーで入力サイズ上限を超えるとクリップボードへ書き込まない", async () => {
    const result = await copyDiagramSvg(event, {
      language: "d2",
      svg: "x".repeat(maxSvgInputBytes + 1)
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "OUTPUT_SVG_COPY_INVALID_INPUT" })
    });
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("SVGコピー前にmain側でも危険なSVG要素を除去する", async () => {
    const result = await copyDiagramSvg(event, {
      language: "d2",
      svg: "<svg><foreignObject><div>unsafe</div></foreignObject><text onload=\"alert(1)\">safe</text><a href=javascript:alert(1)>link</a></svg>"
    });

    expect(result).toEqual({ ok: true, value: { status: "copied" } });
    expect(electronMock.clipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining("<text>safe</text>")
    );
    expect(electronMock.clipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining("<a>link</a>")
    );
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalledWith(
      expect.stringContaining("<foreignObject")
    );
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalledWith(
      expect.stringContaining("onload")
    );
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalledWith(
      expect.stringContaining("javascript:")
    );
  });

  it("SVGコピー失敗時は安全化したエラーを返す", async () => {
    electronMock.clipboardWriteText.mockImplementation(() => {
      throw new Error(`copy failed SERVICE_API_KEY=${["sk", "secret", "value"].join("-")}`);
    });

    const result = await copyDiagramSvg(event, {
      language: "d2",
      svg: "<svg><text>safe</text></svg>"
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "OUTPUT_SVG_COPY_FAILED",
        details: "copy failed SERVICE_API_KEY=[redacted]"
      })
    });
  });
});
