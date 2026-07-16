import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetEditorInputBufferForTests,
  bufferEditorChange,
  discardPendingEditorChanges,
  flushPendingEditorChanges
} from "./editorInputBuffer";

describe("editorInputBuffer", () => {
  afterEach(() => {
    __resetEditorInputBufferForTests();
    vi.useRealTimers();
  });

  it("同じタブの連続入力をまとめて最新本文だけ反映する", async () => {
    vi.useFakeTimers();
    const commit = vi.fn();

    bufferEditorChange({ content: "一", filePath: "note.md", tabId: "tab", commit });
    const generation = bufferEditorChange({ content: "一二", filePath: "note.md", tabId: "tab", commit });

    await vi.advanceTimersByTimeAsync(79);
    expect(commit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith({
      content: "一二",
      filePath: "note.md",
      generation,
      tabId: "tab"
    });
  });

  it("タブごとの保留本文を取り違えず即時確定する", () => {
    vi.useFakeTimers();
    const commit = vi.fn();

    bufferEditorChange({ content: "A", filePath: "a.md", tabId: "a", commit });
    bufferEditorChange({ content: "B", filePath: "b.md", tabId: "b", commit });
    flushPendingEditorChanges(["b"]);

    expect(commit).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0][0]).toMatchObject({ content: "B", filePath: "b.md", tabId: "b" });

    flushPendingEditorChanges();
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0]).toMatchObject({ content: "A", filePath: "a.md", tabId: "a" });
  });

  it("古いtimer世代と破棄した変更を反映しない", async () => {
    vi.useFakeTimers();
    const commit = vi.fn();

    bufferEditorChange({ content: "old", filePath: "note.md", tabId: "tab", commit });
    bufferEditorChange({ content: "new", filePath: "note.md", tabId: "tab", commit });
    discardPendingEditorChanges(["tab"]);

    await vi.runAllTimersAsync();
    expect(commit).not.toHaveBeenCalled();
  });
});
