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

  it("保留中は本文全体を文字列化せず、確定時に最新版だけを1回文字列化する", async () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const oldContent = { toString: vi.fn(() => "古い本文") };
    const latestContent = { toString: vi.fn(() => "最新本文") };

    bufferEditorChange({ content: oldContent, filePath: "note.md", tabId: "tab", commit });
    bufferEditorChange({ content: latestContent, filePath: "note.md", tabId: "tab", commit });

    expect(oldContent.toString).not.toHaveBeenCalled();
    expect(latestContent.toString).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(80);

    expect(oldContent.toString).not.toHaveBeenCalled();
    expect(latestContent.toString).toHaveBeenCalledOnce();
    expect(commit.mock.calls[0][0].content).toBe("最新本文");
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
