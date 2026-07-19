import { describe, expect, it, vi } from "vitest";

import { createTranslator } from "../../shared/i18n";
import { fail } from "../../shared/result";

vi.mock("electron", () => ({ ipcMain: { handle: vi.fn() } }));
vi.mock("../i18n", () => ({
  getCachedMainLanguage: vi.fn(),
  getCachedMainTranslator: vi.fn()
}));

import { localizeIpcResult } from "./localizedIpcHandler";

describe("localizeIpcResult", () => {
  it("日本語固定のIPCエラーを英語UI向けの文言へ変換する", () => {
    expect(localizeIpcResult(
      fail("FILE_CREATE_INVALID_INPUT", "ファイル名を入力してください。", "diagnostic"),
      "en",
      createTranslator("en")
    )).toEqual({
      ok: false,
      error: {
        code: "FILE_CREATE_INVALID_INPUT",
        details: "diagnostic",
        message: "Check the information you entered."
      }
    });
  });

  it("日本語UIでは具体的な既存文言を保持する", () => {
    const result = fail("FILE_ALREADY_EXISTS", "同じ名前のファイルがすでにあります。");
    expect(localizeIpcResult(result, "ja", createTranslator("ja"))).toBe(result);
  });

  it("すでに翻訳済みのエラーは変更しない", () => {
    const result = fail("OUTPUT_PDF_FAILED", "PDFとして保存できませんでした。");
    expect(localizeIpcResult(result, "en", createTranslator("en"))).toBe(result);
  });
});
