import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  fromWebContents: vi.fn(),
  showSaveDialog: vi.fn()
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: electronMock.fromWebContents },
  dialog: { showSaveDialog: electronMock.showSaveDialog }
}));

const runtimeMock = vi.hoisted(() => ({
  renderPreviewHtmlToPdf: vi.fn()
}));

vi.mock("./previewPdfRuntime", () => runtimeMock);

vi.mock("../i18n", async () => {
  const { createTranslator } = await vi.importActual<typeof import("../../shared/i18n")>("../../shared/i18n");

  return {
    getMainTranslator: async () => createTranslator("ja")
  };
});

import { previewOutputHtmlMaxBytes } from "../../shared/ipc";
import { dangerousHtmlFragments } from "../../test/securityFixtures";
import { savePreviewAsPdf } from "./previewPdfHandler";
import { validOutputHtml } from "./outputHandlersTestHelpers";
import { isSavePreviewAsPdfInput } from "./previewPdfValidator";

const event = { sender: {} } as Electron.IpcMainInvokeEvent;

async function expectInvalidHtml(html: string): Promise<void> {
  const input = {
    defaultFileName: "Note",
    html,
    title: "Note"
  };

  expect(isSavePreviewAsPdfInput(input)).toBe(false);
  await expect(savePreviewAsPdf(event, input)).resolves.toEqual({
    ok: false,
    error: expect.objectContaining({ code: "OUTPUT_PDF_INVALID_INPUT" })
  });
}

describe("isSavePreviewAsPdfInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    electronMock.fromWebContents.mockReturnValue(null);
  });

  it("HTMLが空の場合は入力エラーになり、出力処理へ進まない", async () => {
    await expectInvalidHtml("");

    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(runtimeMock.renderPreviewHtmlToPdf).not.toHaveBeenCalled();
  });

  it("HTMLサイズ上限を超えると入力エラーになり、出力処理へ進まない", async () => {
    await expectInvalidHtml("a".repeat(previewOutputHtmlMaxBytes + 1));

    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(runtimeMock.renderPreviewHtmlToPdf).not.toHaveBeenCalled();
  });

  it("CSPのないHTMLは入力エラーになり、出力処理へ進まない", async () => {
    await expectInvalidHtml(
      '<!doctype html><html><head><title>Note</title></head><body><main class="relic-output-body">本文</main></body></html>'
    );

    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(runtimeMock.renderPreviewHtmlToPdf).not.toHaveBeenCalled();
  });

  it("出力HTMLの必須構造がない場合は入力エラーになる", async () => {
    const invalidHtmlValues = [
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><main class="relic-output-body">本文</main></body></html>',
      '<!doctype html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><main class="relic-output-body">本文</main></body>',
      '<!doctype html><html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"><body><main class="relic-output-body">本文</main></body></html>',
      '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><div>本文</div></body></html>'
    ];

    for (const html of invalidHtmlValues) {
      await expectInvalidHtml(html);
    }
    expect(runtimeMock.renderPreviewHtmlToPdf).not.toHaveBeenCalled();
  });

  it("許可外タグや危険属性を含むHTMLは入力エラーになる", async () => {
    await expectInvalidHtml(
      validOutputHtml(
        '<script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">link</a><meta http-equiv = "refresh" content="0;url=https://example.com"><span style="background:url(https://example.com/a.png)">x</span>'
      )
    );

    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(runtimeMock.renderPreviewHtmlToPdf).not.toHaveBeenCalled();
  });

  it("攻撃文字列コーパスを含むHTMLは出力処理前に拒否する", async () => {
    await expectInvalidHtml(validOutputHtml(dangerousHtmlFragments.join("")));

    expect(electronMock.showSaveDialog).not.toHaveBeenCalled();
    expect(runtimeMock.renderPreviewHtmlToPdf).not.toHaveBeenCalled();
  });
});
