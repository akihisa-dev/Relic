import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  clipboardWriteText: vi.fn(),
  getPath: vi.fn(),
  handle: vi.fn()
}));

vi.mock("electron", () => ({
  app: { getPath: electronMock.getPath },
  clipboard: {
    writeText: electronMock.clipboardWriteText
  },
  ipcMain: { handle: electronMock.handle }
}));

import { copyEditorTextToClipboardChannel } from "../../shared/ipc";
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

  it("エディタ貼り付け用途のクリップボード読み取りハンドラを登録しない", () => {
    expect(electronMock.handle.mock.calls.map(([channel]) => channel)).not.toContain("editor:readClipboardForPaste");
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
});
