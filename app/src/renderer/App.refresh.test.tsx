import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkspaceState } from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState
} from "../test/rendererTestUtils";
import { allRailFeatureToggles, renderApp } from "./appTestHelpers";
import { useEditorStore } from "./store/editorStore";

const noteWorkspace: WorkspaceState = {
  ...testWorkspaceState,
  fileTree: [{ name: "Note", path: "Note.md", type: "file" }],
  workspaces: [testWorkspaceState.activeWorkspace!]
};

describe("App workspace refresh", () => {
  beforeAll(installMatchMediaMock);

  afterEach(() => {
    vi.clearAllMocks();
    resetRendererStores();
  });

  it("設定の直下から一度だけ開始し、実行中の回転表示と完了通知を示す", async () => {
    const deferred = createDeferred<RelicResult<WorkspaceState>>();
    const refreshWorkspace = vi.fn().mockReturnValue(deferred.promise);
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace }),
      refreshWorkspace
    });

    await renderApp();
    const rail = await screen.findByRole("navigation", { name: "ビュー切り替え" });
    const settingsButton = within(rail).getByRole("button", { name: "設定" });
    const refreshButton = within(rail).getByRole("button", { name: "リフレッシュ" });

    expect(settingsButton.nextElementSibling).toBe(refreshButton);
    expect(refreshButton).not.toHaveAttribute("title");

    fireEvent.click(refreshButton);
    await waitFor(() => expect(refreshWorkspace).toHaveBeenCalledTimes(1));
    expect(refreshButton).toBeDisabled();
    expect(refreshButton.querySelector(".rail-refresh-icon--spinning")).not.toBeNull();
    fireEvent.click(refreshButton);
    expect(refreshWorkspace).toHaveBeenCalledTimes(1);

    await act(async () => deferred.resolve({ ok: true, value: noteWorkspace }));

    expect(await screen.findByText("リフレッシュしました")).toHaveClass("toast--info");
    await waitFor(() => expect(refreshButton).toBeEnabled());
  });

  it("開いているタブを維持しながら外部の本文変更を反映する", async () => {
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({ ok: true, value: { content: "before", name: "Note", path: "Note.md" } })
      .mockResolvedValueOnce({ ok: true, value: { content: "after", name: "Note", path: "Note.md" } });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace }),
      readMarkdownFile,
      refreshWorkspace: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "· Note" }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    fireEvent.click(screen.getByRole("button", { name: "リフレッシュ" }));

    await waitFor(() => {
      const tab = useEditorStore.getState().tabs[tabId];
      expect(tab?.kind === "file" ? tab.content : null).toBe("after");
    });
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(tabId);
    expect(useEditorStore.getState().leftPane.tabIds).toContain(tabId);
  });

  it("未保存内容の保存に失敗した場合は再同期せず、本文を保持する", async () => {
    const refreshWorkspace = vi.fn();
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "before", name: "Note", path: "Note.md" }
      }),
      refreshWorkspace,
      writeMarkdownFile: vi.fn().mockResolvedValue({
        error: { code: "WRITE_FAILED", message: "保存できませんでした。" },
        ok: false
      })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "· Note" }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());
    const tabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => useEditorStore.getState().updateTabContent(tabId, "unsaved"));

    fireEvent.click(screen.getByRole("button", { name: "リフレッシュ" }));

    expect(await screen.findByText("保存できませんでした。")).toHaveClass("toast--error");
    expect(refreshWorkspace).not.toHaveBeenCalled();
    const tab = useEditorStore.getState().tabs[tabId];
    expect(tab?.kind === "file" ? tab.content : null).toBe("unsaved");
  });

  it("再同期に失敗した場合は既存状態を保ち、対象が分かる通知を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace }),
      refreshWorkspace: vi.fn().mockResolvedValue({
        error: {
          code: "WORKSPACE_REFRESH_FAILED",
          message: "ファイル一覧と派生データを更新できませんでした。"
        },
        ok: false
      })
    });

    await renderApp();
    await screen.findByRole("button", { name: "· Note" });
    fireEvent.click(screen.getByRole("button", { name: "リフレッシュ" }));

    expect(await screen.findByText("ファイル一覧と派生データを更新できませんでした。"))
      .toHaveClass("toast--error");
    expect(screen.getByRole("button", { name: "· Note" })).toBeInTheDocument();
  });

  it("開いているファイルだけ再取得できない場合は部分失敗として通知する", async () => {
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "before", name: "Note", path: "Note.md" }
      })
      .mockResolvedValueOnce({
        error: { code: "FILE_READ_FAILED", message: "ファイルを読み込めませんでした。" },
        ok: false
      });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace }),
      readMarkdownFile,
      refreshWorkspace: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "· Note" }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    fireEvent.click(screen.getByRole("button", { name: "リフレッシュ" }));

    expect(await screen.findByText("開いているファイルの再読み込みに一部失敗しました（1件）。"))
      .toHaveClass("toast--error");
    const tab = useEditorStore.getState().tabs[tabId];
    expect(tab?.kind === "file" ? tab.content : null).toBe("before");
  });

  it("リフレッシュ中の監視通知は完了後に一度だけ処理する", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] =
      () => undefined;
    const deferred = createDeferred<RelicResult<WorkspaceState>>();
    const getWorkspaceState = vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace });
    window.relic = makeRelicApi({
      getWorkspaceState,
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      refreshWorkspace: vi.fn().mockReturnValue(deferred.promise)
    });

    await renderApp();
    await screen.findByRole("button", { name: "· Note" });
    fireEvent.click(screen.getByRole("button", { name: "リフレッシュ" }));
    await waitFor(() => expect(window.relic?.refreshWorkspace).toHaveBeenCalledTimes(1));

    act(() => workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" }));
    expect(getWorkspaceState).toHaveBeenCalledTimes(1);

    await act(async () => deferred.resolve({ ok: true, value: noteWorkspace }));
    await waitFor(() => expect(getWorkspaceState).toHaveBeenCalledTimes(2));
  });

  it("バブルを開いたまま再同期すると派生データを再取得する", async () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({
      ok: true,
      value: { links: [], nodes: [] }
    });
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({
        ok: true,
        value: { ...allRailFeatureToggles, sphere: false }
      }),
      getWorkspaceGraph,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace }),
      refreshWorkspace: vi.fn().mockResolvedValue({ ok: true, value: noteWorkspace })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "バブル" }));
    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "リフレッシュ" }));

    await waitFor(() => expect(getWorkspaceGraph).toHaveBeenCalledTimes(2));
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}
