import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi, testWorkspaceState } from "../../test/rendererTestUtils";
import type { WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useWorkspaceRegistryActions", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("非アクティブなワークスペースを一覧から外しても現在のタブを閉じない", async () => {
    const beforeCloseAllTabs = vi.fn().mockReturnValue(true);
    const closeAllTabs = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      removeWorkspace: vi.fn().mockResolvedValue({ ok: true, value: testWorkspaceState })
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("ws-active");
      return useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "ws-active",
        beforeCloseAllTabs,
        closeAllTabs,
        setWorkspaceError: vi.fn(),
        setWorkspaceState
      });
    });

    act(() => result.current.handleRemoveWorkspace("ws-other"));

    await waitFor(() => expect(setWorkspaceState).toHaveBeenCalledWith(testWorkspaceState));
    expect(beforeCloseAllTabs).not.toHaveBeenCalled();
    expect(closeAllTabs).not.toHaveBeenCalled();
  });

  it("ワークスペース選択をキャンセルして現在の状態が返った場合はタブを閉じない", async () => {
    const closeAllTabs = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      openWorkspace: vi.fn().mockResolvedValue({ ok: true, value: testWorkspaceState })
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("ws-1");
      return useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "ws-1",
        activeWorkspacePath: "/tmp/Notes",
        closeAllTabs,
        setWorkspaceError: vi.fn(),
        setWorkspaceState
      });
    });

    act(() => result.current.handleOpenWorkspace());

    await waitFor(() => expect(setWorkspaceState).toHaveBeenCalledWith(testWorkspaceState));
    expect(closeAllTabs).not.toHaveBeenCalled();
  });

  it("同じIDのワークスペースを別の場所へ再リンクした場合はタブを閉じる", async () => {
    const relinkedState = workspaceState("ws-1");
    const closeAllTabs = vi.fn();
    window.relic = makeRelicApi({
      relinkWorkspace: vi.fn().mockResolvedValue({ ok: true, value: relinkedState })
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("ws-1");
      return useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "ws-1",
        activeWorkspacePath: "/workspace/original",
        closeAllTabs,
        setWorkspaceError: vi.fn(),
        setWorkspaceState: vi.fn()
      });
    });

    act(() => result.current.handleRelinkWorkspace("ws-1"));

    await waitFor(() => expect(closeAllTabs).toHaveBeenCalledOnce());
  });

  it("切替要求が競合した場合は最後に開始したワークスペースだけを適用する", async () => {
    const first = deferred<RelicResult<WorkspaceState>>();
    const second = deferred<RelicResult<WorkspaceState>>();
    const setWorkspaceState = vi.fn();
    const closeAllTabs = vi.fn();
    window.relic = makeRelicApi({
      switchWorkspace: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      return useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        closeAllTabs,
        setWorkspaceError: vi.fn(),
        setWorkspaceState
      });
    });

    act(() => {
      result.current.handleSwitchWorkspace("workspace-b");
      result.current.handleSwitchWorkspace("workspace-c");
    });
    await act(async () => first.resolve({ ok: true, value: workspaceState("workspace-b") }));
    expect(setWorkspaceState).not.toHaveBeenCalled();

    await act(async () => second.resolve({ ok: true, value: workspaceState("workspace-c") }));
    expect(setWorkspaceState).toHaveBeenCalledWith(workspaceState("workspace-c"));
    expect(closeAllTabs).toHaveBeenCalledOnce();
  });

  it("独立した登録変更と表示設定変更は互いの正常結果を取り消さない", async () => {
    const remove = deferred<RelicResult<WorkspaceState>>();
    const togglePin = deferred<RelicResult<WorkspaceState>>();
    const stateAfterPin = workspaceState("workspace-a");
    stateAfterPin.pinnedPaths = ["Pinned.md"];
    const stateAfterRemoval = workspaceState("workspace-a");
    stateAfterRemoval.workspaces = [{ id: "workspace-a", name: "workspace-a", path: "/workspace/workspace-a" }];
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      removeWorkspace: vi.fn().mockReturnValue(remove.promise),
      togglePin: vi.fn().mockReturnValue(togglePin.promise)
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      return useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        closeAllTabs: vi.fn(),
        setWorkspaceError: vi.fn(),
        setWorkspaceState
      });
    });

    act(() => {
      result.current.handleRemoveWorkspace("workspace-b");
      result.current.handleTogglePin("Pinned.md");
    });
    await act(async () => togglePin.resolve({ ok: true, value: stateAfterPin }));
    await act(async () => remove.resolve({ ok: true, value: stateAfterRemoval }));

    expect(setWorkspaceState.mock.calls).toEqual([
      [stateAfterPin],
      [stateAfterRemoval]
    ]);
  });

  it("close確認待ちの間にworkspaceが変わった場合は古い切替を開始しない", async () => {
    const closeCheck = deferred<boolean>();
    const switchWorkspace = vi.fn();
    window.relic = makeRelicApi({ switchWorkspace });
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      const actions = useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        beforeCloseAllTabs: () => closeCheck.promise,
        closeAllTabs: vi.fn(),
        setWorkspaceError: vi.fn(),
        setWorkspaceState: vi.fn()
      });
      return { actions, guard };
    });

    act(() => result.current.actions.handleSwitchWorkspace("workspace-b"));
    expect(switchWorkspace).not.toHaveBeenCalled();

    act(() => result.current.guard.invalidateWorkspaceRequests("workspace-c"));
    await act(async () => closeCheck.resolve(true));

    expect(switchWorkspace).not.toHaveBeenCalled();
  });
});

function workspaceState(id: string): WorkspaceState {
  return {
    activeWorkspace: { id, name: id, path: `/workspace/${id}` },
    fileTree: [],
    pinnedPaths: [],
    workspaces: []
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
