import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi, makeWorkspaceState, testWorkspaceState } from "../../test/rendererTestUtils";
import { createTranslator } from "../../shared/i18n";
import type { WorkspaceState } from "../../shared/ipc";
import type { RelicError, RelicResult } from "../../shared/result";
import { useWorkspaceRegistryActions, workspaceRecoveryErrorMessage } from "./useWorkspaceRegistryActions";
import { useWorkspaceSession } from "./useWorkspaceSession";

describe("useWorkspaceRegistryActions", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it.each(["open", "create", "relink"] as const)("%s完了後は切替先でも再操作できる", async (operation) => {
    const next = makeWorkspaceState("workspace-b");
    const response = vi.fn().mockResolvedValue({ ok: true, value: next });
    window.relic = makeRelicApi({ openWorkspace: response, createNewWorkspace: response, relinkWorkspace: response });
    const { result } = renderHook(() => {
      const session = useWorkspaceSession(makeWorkspaceState("workspace-a"));
      return {
        session,
        actions: useWorkspaceRegistryActions({
          ...session,
          activeWorkspaceId: session.workspaceState?.activeWorkspace?.id,
          activeWorkspacePath: session.workspaceState?.activeWorkspace?.path,
          closeAllTabs: vi.fn(),
          setWorkspaceError: vi.fn()
        })
      };
    });
    const invoke = () => {
      if (operation === "open") result.current.actions.handleOpenWorkspace();
      if (operation === "create") result.current.actions.handleCreateNewWorkspace();
      if (operation === "relink") result.current.actions.handleRelinkWorkspace("workspace-a");
    };
    await act(async () => invoke());
    expect(result.current.session.workspaceState?.activeWorkspace?.id).toBe("workspace-b");
    expect(result.current.actions.isOpeningWorkspace || result.current.actions.isCreatingWorkspace || result.current.actions.isRelinkingWorkspace).toBe(false);
    await act(async () => invoke());
    expect(response).toHaveBeenCalledTimes(2);
  });

  it.each(["cancel", "error", "reject"] as const)("%s後も処理中状態を解除する", async (outcome) => {
    const initial = makeWorkspaceState("workspace-a");
    const response = outcome === "reject"
      ? vi.fn().mockRejectedValue(new Error("transport detail"))
      : vi.fn().mockResolvedValue(outcome === "cancel"
        ? { ok: true, value: initial }
        : { ok: false, error: { code: "WORKSPACE_OPEN_FAILED", message: "failed" } });
    window.relic = makeRelicApi({ openWorkspace: response });
    const { result } = renderHook(() => {
      const session = useWorkspaceSession(initial);
      return useWorkspaceRegistryActions({
        ...session,
        activeWorkspaceId: session.workspaceState?.activeWorkspace?.id,
        activeWorkspacePath: session.workspaceState?.activeWorkspace?.path,
        closeAllTabs: vi.fn(),
        setWorkspaceError: vi.fn()
      });
    });
    await act(async () => result.current.handleOpenWorkspace());
    expect(result.current.isOpeningWorkspace).toBe(false);
  });

  it("古い完了は新しい操作の処理中状態を解除しない", async () => {
    const first = deferred<RelicResult<WorkspaceState>>();
    const second = deferred<RelicResult<WorkspaceState>>();
    window.relic = makeRelicApi({ openWorkspace: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) });
    const { result } = renderHook(() => {
      const session = useWorkspaceSession(makeWorkspaceState("workspace-a"));
      return useWorkspaceRegistryActions({
        ...session,
        activeWorkspaceId: session.workspaceState?.activeWorkspace?.id,
        activeWorkspacePath: session.workspaceState?.activeWorkspace?.path,
        closeAllTabs: vi.fn(),
        setWorkspaceError: vi.fn()
      });
    });
    act(() => { result.current.handleOpenWorkspace(); result.current.handleOpenWorkspace(); });
    await act(async () => first.resolve({ ok: true, value: makeWorkspaceState("workspace-b") }));
    expect(result.current.isOpeningWorkspace).toBe(true);
    await act(async () => second.resolve({ ok: true, value: makeWorkspaceState("workspace-c") }));
    expect(result.current.isOpeningWorkspace).toBe(false);
  });

  it("非アクティブなワークスペースを一覧から外しても現在のタブを閉じない", async () => {
    const beforeCloseAllTabs = vi.fn().mockReturnValue(true);
    const closeAllTabs = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      removeWorkspace: vi.fn().mockResolvedValue({ ok: true, value: testWorkspaceState })
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceSession(makeWorkspaceState("ws-active"));
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
      const guard = useWorkspaceSession(makeWorkspaceState("ws-1"));
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
      const guard = useWorkspaceSession(makeWorkspaceState("ws-1"));
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

  it("同じIDのcase-only rename成功後も旧要求を無効化する", async () => {
    const rename = deferred<RelicResult<WorkspaceState>>();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      renameWorkspace: vi.fn().mockReturnValue(rename.promise)
    });

    const { result } = renderHook(() => {
      const guard = useWorkspaceSession(makeWorkspaceState("ws-1"));
      return {
        actions: useWorkspaceRegistryActions({
          ...guard,
          activeWorkspaceId: "ws-1",
          activeWorkspacePath: "/workspace/notes",
          closeAllTabs: vi.fn(),
          setWorkspaceError: vi.fn(),
          setWorkspaceState
        }),
        guard
      };
    });
    const staleRequest = result.current.guard.beginWorkspaceRequest();

    let renamePromise: Promise<boolean>;
    act(() => {
      renamePromise = result.current.actions.handleRenameWorkspace("ws-1", "Notes");
    });
    await act(async () => rename.resolve({ ok: true, value: workspaceState("ws-1") }));

    await expect(renamePromise!).resolves.toBe(true);
    expect(staleRequest()).toBe(false);
    expect(setWorkspaceState).toHaveBeenCalledOnce();
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
      const guard = useWorkspaceSession(makeWorkspaceState("workspace-a"));
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
      const guard = useWorkspaceSession(makeWorkspaceState("workspace-a"));
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

  it("IPC拒否時は現在の要求だけへ汎用エラーを表示する", async () => {
    const setWorkspaceError = vi.fn();
    window.relic = makeRelicApi({
      switchWorkspace: vi.fn().mockRejectedValue(new Error("internal transport detail"))
    });
    const { result } = renderHook(() => {
      const guard = useWorkspaceSession(makeWorkspaceState("workspace-a"));
      return useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        closeAllTabs: vi.fn(),
        setWorkspaceError,
        setWorkspaceState: vi.fn()
      });
    });

    act(() => result.current.handleSwitchWorkspace("workspace-b"));

    await waitFor(() => expect(setWorkspaceError).toHaveBeenCalledWith("The operation could not be completed."));
    expect(setWorkspaceError).not.toHaveBeenCalledWith("internal transport detail");
  });

  it("close確認待ちの間にworkspaceが変わった場合は古い切替を開始しない", async () => {
    const closeCheck = deferred<boolean>();
    const switchWorkspace = vi.fn();
    window.relic = makeRelicApi({ switchWorkspace });
    const { result } = renderHook(() => {
      const guard = useWorkspaceSession(makeWorkspaceState("workspace-a"));
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

  it("復旧情報を日本語へ変換し、設定移行の内部オブジェクトを表示しない", () => {
    const t = createTranslator("ja");
    const error: RelicError = {
      code: "WORKSPACE_RENAME_FAILED",
      message: "fallback",
      recovery: {
        currentPath: "/tmp/.relic-rename-hidden",
        oldPath: "/tmp/Notes",
        reason: "rollback-failed",
        settingsMigration: {
          phase: "new-settings",
          secret: "do-not-display",
          status: "write-failed"
        },
        status: "recovery-required"
      }
    };

    const message = workspaceRecoveryErrorMessage(error, t);

    expect(message).toContain("/tmp/.relic-rename-hidden");
    expect(message).toContain("/tmp/Notes");
    expect(message).toContain("新しいワークスペース設定を保存できませんでした");
    expect(message).toContain("元の状態へ戻せませんでした");
    expect(message).not.toContain("do-not-display");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("new-settings");
  });

  it("未知の復旧理由や設定状態を汎用の翻訳へ変換する", () => {
    const t = createTranslator("en");
    const error: RelicError = {
      code: "WORKSPACE_RENAME_FAILED",
      message: "fallback",
      recovery: {
        currentPath: null,
        oldPath: "/tmp/Notes",
        reason: "secret-internal-reason",
        settingsMigration: { status: "secret-internal-status" },
        status: "recovery-required"
      }
    };

    const message = workspaceRecoveryErrorMessage(error, t);

    expect(message).toContain("an unknown recovery state");
    expect(message).toContain("unknown");
    expect(message).not.toContain("secret-internal");
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
