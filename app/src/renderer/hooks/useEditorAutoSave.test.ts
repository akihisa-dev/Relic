import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useEditorStore, type Tab } from "../store/editorStore";
import { useEditorAutoSave } from "./useEditorAutoSave";

function resetStore(tabs: Record<string, Tab> = {}): void {
  useEditorStore.setState({
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: { activeTabId: null, history: [], tabIds: [] },
    rightPane: { activeTabId: null, history: [], tabIds: [] },
    tabs
  });
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("useEditorAutoSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.relic = makeRelicApi({
      writeMarkdownFile: vi.fn().mockResolvedValue({ ok: true, value: undefined })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    resetStore();
  });

  it("開いている全ファイルタブを保存対象にする", async () => {
    const tabs: Record<string, Tab> = {
      first: { content: "first draft", id: "first", kind: "file", name: "First", path: "first.md", savedContent: "first" },
      second: { content: "second draft", id: "second", kind: "file", name: "Second", path: "second.md", savedContent: "second" }
    };
    resetStore(tabs);

    renderHook(() => useEditorAutoSave({
      conflictCloseBlockedMessage: "conflict",
      saveFailedMessage: "save failed",
      tabs: useEditorStore.getState().tabs
    }));

    await vi.advanceTimersByTimeAsync(1000);

    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledWith({
      content: "first draft",
      expectedContent: "first",
      path: "first.md"
    });
    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledWith({
      content: "second draft",
      expectedContent: "second",
      path: "second.md"
    });
  });

  it("保存中に本文が変わった場合は最新本文だけを追加保存する", async () => {
    const firstSave = deferred<{ ok: true; value: undefined }>();
    const secondSave = deferred<{ ok: true; value: undefined }>();
    window.relic = makeRelicApi({
      writeMarkdownFile: vi.fn()
        .mockReturnValueOnce(firstSave.promise)
        .mockReturnValueOnce(secondSave.promise)
    });
    resetStore({
      tab: { content: "初稿", id: "tab", kind: "file", name: "Memo", path: "memo.md", savedContent: "" }
    });

    const { rerender } = renderHook(({ tabs }) => useEditorAutoSave({
      conflictCloseBlockedMessage: "conflict",
      saveFailedMessage: "save failed",
      tabs
    }), {
      initialProps: { tabs: useEditorStore.getState().tabs }
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(1);

    act(() => {
      useEditorStore.getState().updateTabContent("tab", "改稿");
    });
    rerender({ tabs: useEditorStore.getState().tabs });

    firstSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);

    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(2);
    expect(window.relic!.writeMarkdownFile).toHaveBeenLastCalledWith({
      content: "改稿",
      expectedContent: "",
      path: "memo.md"
    });

    secondSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);

    const tab = useEditorStore.getState().tabs.tab;
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") expect(tab.savedContent).toBe("改稿");
  });

  it("保存中に外部変更と衝突した場合は保存待ち本文を追加保存せず衝突を維持する", async () => {
    const firstSave = deferred<{ ok: true; value: undefined }>();
    window.relic = makeRelicApi({
      writeMarkdownFile: vi.fn().mockReturnValueOnce(firstSave.promise)
    });
    resetStore({
      tab: { content: "初稿", id: "tab", kind: "file", name: "Memo", path: "memo.md", savedContent: "Base" }
    });

    const { rerender } = renderHook(({ tabs }) => useEditorAutoSave({
      conflictCloseBlockedMessage: "conflict",
      saveFailedMessage: "save failed",
      tabs
    }), {
      initialProps: { tabs: useEditorStore.getState().tabs }
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(1);

    act(() => {
      useEditorStore.getState().updateTabContent("tab", "改稿");
    });
    rerender({ tabs: useEditorStore.getState().tabs });

    act(() => {
      useEditorStore.getState().setTabExternalConflict("tab", "外部版");
    });
    rerender({ tabs: useEditorStore.getState().tabs });

    firstSave.resolve({ ok: true, value: undefined });
    await vi.advanceTimersByTimeAsync(0);

    expect(window.relic!.writeMarkdownFile).toHaveBeenCalledTimes(1);

    const tab = useEditorStore.getState().tabs.tab;
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") {
      expect(tab.content).toBe("改稿");
      expect(tab.savedContent).toBe("Base");
      expect(tab.externalConflict?.content).toBe("外部版");
    }
  });

  it("閉じる前保存は衝突中のタブを保存せず止める", async () => {
    resetStore({
      tab: {
        content: "Relic",
        externalConflict: { content: "External" },
        id: "tab",
        kind: "file",
        name: "Memo",
        path: "memo.md",
        savedContent: "Base"
      }
    });

    const { result } = renderHook(() => useEditorAutoSave({
      conflictCloseBlockedMessage: "conflict",
      saveFailedMessage: "save failed",
      tabs: useEditorStore.getState().tabs
    }));

    await expect(result.current.flushTabsBeforeClose(["tab"])).resolves.toEqual({
      ok: false,
      message: "conflict"
    });
    expect(window.relic!.writeMarkdownFile).not.toHaveBeenCalled();
  });
});
