import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "../../shared/i18n";
import { fail } from "../../shared/result";

const electronMock = vi.hoisted(() => ({ handle: vi.fn() }));

vi.mock("electron", () => ({ ipcMain: { handle: electronMock.handle } }));
vi.mock("../i18n", async () => {
  const { createTranslator } = await vi.importActual<typeof import("../../shared/i18n")>("../../shared/i18n");
  return {
    getCachedMainLanguage: vi.fn(() => "ja"),
    getCachedMainTranslator: vi.fn(() => createTranslator("ja"))
  };
});

import { configureIpcSenderAuthorization } from "./ipcSenderAuthorization";
import { handleLocalizedIpc, localizeIpcResult } from "./localizedIpcHandler";

afterEach(() => {
  configureIpcSenderAuthorization(() => true);
  vi.clearAllMocks();
});

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

describe("handleLocalizedIpc", () => {
  it("許可されていない送信元を処理本体へ渡さず拒否する", async () => {
    const handler = vi.fn(() => ({ ok: true }));
    configureIpcSenderAuthorization(() => false);

    handleLocalizedIpc("test:authorized-sender", handler);
    const registeredHandler = electronMock.handle.mock.calls.at(-1)?.[1] as
      | ((event: { sender: unknown }) => Promise<unknown>)
      | undefined;
    if (!registeredHandler) throw new Error("IPC handler was not registered.");

    await expect(registeredHandler({ sender: {} })).resolves.toMatchObject({
      error: { code: "IPC_UNAUTHORIZED_SENDER" },
      ok: false
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
