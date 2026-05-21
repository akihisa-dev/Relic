import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAutoSave } from "./useAutoSave";

describe("useAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.relic = {
      writeMarkdownCard: vi.fn().mockResolvedValue({ ok: true, value: undefined })
    } as unknown as typeof window.relic;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("1秒後に writeMarkdownCard を呼ぶ", async () => {
    renderHook(() => useAutoSave("# メモ", "memo.md", true));

    expect(window.relic!.writeMarkdownCard).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);

    expect(window.relic!.writeMarkdownCard).toHaveBeenCalledWith({
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

  it("内容が変わると以前のタイマーをキャンセルして1秒後に保存する", async () => {
    const { rerender } = renderHook(({ content }) => useAutoSave(content, "memo.md", true), {
      initialProps: { content: "初稿" }
    });

    await vi.advanceTimersByTimeAsync(500);
    rerender({ content: "改稿" });
    await vi.advanceTimersByTimeAsync(500);

    expect(window.relic!.writeMarkdownCard).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(window.relic!.writeMarkdownCard).toHaveBeenCalledTimes(1);
    expect(window.relic!.writeMarkdownCard).toHaveBeenCalledWith({
      content: "改稿",
      path: "memo.md"
    });
  });

  it("enabled が false のとき保存しない", async () => {
    renderHook(() => useAutoSave("# メモ", "memo.md", false));

    await vi.advanceTimersByTimeAsync(2000);

    expect(window.relic!.writeMarkdownCard).not.toHaveBeenCalled();
  });

  it("path が null のとき保存しない", async () => {
    renderHook(() => useAutoSave("# メモ", null, true));

    await vi.advanceTimersByTimeAsync(2000);

    expect(window.relic!.writeMarkdownCard).not.toHaveBeenCalled();
  });

  it("アンマウント時にタイマーをキャンセルして保存しない", async () => {
    const { unmount } = renderHook(() => useAutoSave("# メモ", "memo.md", true));

    await vi.advanceTimersByTimeAsync(500);
    unmount();
    await vi.advanceTimersByTimeAsync(1000);

    expect(window.relic!.writeMarkdownCard).not.toHaveBeenCalled();
  });
});
