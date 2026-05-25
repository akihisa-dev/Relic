import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoSave } from "./useAutoSave";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.relic = {
      writeMarkdownFile: vi.fn().mockResolvedValue({ ok: true, value: undefined })
    } as unknown as typeof window.relic;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("1秒後に writeMarkdownFile を呼ぶ", async () => {
    renderHook(() => useAutoSave("# メモ", "memo.md", true));

    expect(window.relic!.writeMarkdownFile).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledWith({
      content: "# メモ",
      path: "memo.md"
    });
  });

  it("保存成功後に onSaved を呼ぶ", async () => {
    const onSaved = vi.fn();

    renderHook(() => useAutoSave("# メモ", "memo.md", true, onSaved));

    await vi.advanceTimersByTimeAsync(1000);

    expect(onSaved).toHaveBeenCalledWith("memo.md");
  });

  it("保存中に内容が変わると完了後に最新内容だけを追加保存する", async () => {
    const firstSave = deferred<{ ok: true; value: undefined }>();
    const secondSave = deferred<{ ok: true; value: undefined }>();

    window.relic = {
      writeMarkdownFile: vi.fn()
        .mockReturnValueOnce(firstSave.promise)
        .mockReturnValueOnce(secondSave.promise)
    } as unknown as typeof window.relic;

    const { rerender } = renderHook(({ content }) => useAutoSave(content, "memo.md", true), {
      initialProps: { content: "初稿" }
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(1);
    expect(window.relic!.writeMarkdownFile).toHaveBeenLastCalledWith({
      content: "初稿",
      path: "memo.md"
    });

    rerender({ content: "改稿" });
    firstSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);

    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(2);
    expect(window.relic!.writeMarkdownFile).toHaveBeenLastCalledWith({
      content: "改稿",
      path: "memo.md"
    });

    secondSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);
  });

  it("古い保存完了では onSaved を呼ばず最新内容の保存完了だけを通知する", async () => {
    const firstSave = deferred<{ ok: true; value: undefined }>();
    const secondSave = deferred<{ ok: true; value: undefined }>();
    const onSaved = vi.fn();

    window.relic = {
      writeMarkdownFile: vi.fn()
        .mockReturnValueOnce(firstSave.promise)
        .mockReturnValueOnce(secondSave.promise)
    } as unknown as typeof window.relic;

    const { rerender } = renderHook(({ content }) => useAutoSave(content, "memo.md", true, onSaved), {
      initialProps: { content: "初稿" }
    });

    await vi.advanceTimersByTimeAsync(1000);
    rerender({ content: "改稿" });
    firstSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);

    expect(onSaved).not.toHaveBeenCalled();

    secondSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith("memo.md");
  });

  it("保存失敗後に onSaveError を呼ぶ", async () => {
    const onSaveError = vi.fn();

    window.relic = {
      writeMarkdownFile: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" }
      })
    } as unknown as typeof window.relic;

    renderHook(() => useAutoSave("# メモ", "memo.md", true, undefined, onSaveError));

    await vi.advanceTimersByTimeAsync(1000);

    expect(onSaveError).toHaveBeenCalledWith("ファイルを保存できませんでした。");
  });

  it("内容が変わると以前のタイマーをキャンセルして1秒後に保存する", async () => {
    const { rerender } = renderHook(({ content }) => useAutoSave(content, "memo.md", true), {
      initialProps: { content: "初稿" }
    });

    await vi.advanceTimersByTimeAsync(500);
    rerender({ content: "改稿" });
    await vi.advanceTimersByTimeAsync(500);

    expect(window.relic!.writeMarkdownFile).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(1);
    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledWith({
      content: "改稿",
      path: "memo.md"
    });
  });

  it("enabled が false のとき保存しない", async () => {
    renderHook(() => useAutoSave("# メモ", "memo.md", false));

    await vi.advanceTimersByTimeAsync(2000);

    expect(window.relic!.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("path が null のとき保存しない", async () => {
    renderHook(() => useAutoSave("# メモ", null, true));

    await vi.advanceTimersByTimeAsync(2000);

    expect(window.relic!.writeMarkdownFile).not.toHaveBeenCalled();
  });

  it("アンマウント時にタイマーをキャンセルして保存しない", async () => {
    const { unmount } = renderHook(() => useAutoSave("# メモ", "memo.md", true));

    await vi.advanceTimersByTimeAsync(500);
    unmount();
    await vi.advanceTimersByTimeAsync(1000);

    expect(window.relic!.writeMarkdownFile).not.toHaveBeenCalled();
  });
});
