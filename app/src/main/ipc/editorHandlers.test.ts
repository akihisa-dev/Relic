import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  clipboardReadText: vi.fn(),
  clipboardWriteText: vi.fn(),
  getPath: vi.fn(),
  handle: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  clipboard: {
    readText: electronMock.clipboardReadText,
    writeText: electronMock.clipboardWriteText
  },
  ipcMain: { handle: electronMock.handle }
}));

import { copyEditorTextToClipboardChannel, readEditorTextFromClipboardChannel } from "../../shared/ipc";
import { registerEditorHandlers } from "./editorHandlers";

describe("editor clipboard IPC handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerEditorHandlers();
  });

  function handlerFor(channel: string): (...args: unknown[]) => Promise<unknown> {
    const handler = electronMock.handle.mock.calls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
    if (!handler) throw new Error(`${channel} handler was not registered.`);
    return handler;
  }

  it("エディタ貼り付け用途のクリップボード読み取りハンドラを登録する", async () => {
    electronMock.clipboardReadText.mockReturnValue("pasted");

    const result = await handlerFor(readEditorTextFromClipboardChannel)({});

    expect(result).toEqual({ ok: true, value: "pasted" });
    expect(electronMock.clipboardReadText).toHaveBeenCalled();
  });

  it("エディタコピー用途のテキストだけを書き込む", async () => {
    const result = await handlerFor(copyEditorTextToClipboardChannel)({}, { text: "selected" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(electronMock.clipboardWriteText).toHaveBeenCalledWith("selected");
  });

  it("空文字と大きすぎるテキストは書き込まない", async () => {
    const emptyResult = await handlerFor(copyEditorTextToClipboardChannel)({}, { text: "" });
    const largeResult = await handlerFor(copyEditorTextToClipboardChannel)({}, { text: "x".repeat(1_000_001) });

    expect(emptyResult).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "EDITOR_CLIPBOARD_INVALID_INPUT" }),
      ok: false
    }));
    expect(largeResult).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "EDITOR_CLIPBOARD_INVALID_INPUT" }),
      ok: false
    }));
    expect(electronMock.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("大きすぎる貼り付けテキストは読み取り結果として返さない", async () => {
    electronMock.clipboardReadText.mockReturnValue("x".repeat(1_000_001));

    const result = await handlerFor(readEditorTextFromClipboardChannel)({});

    expect(result).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: "EDITOR_CLIPBOARD_INVALID_INPUT" }),
      ok: false
    }));
  });
});
