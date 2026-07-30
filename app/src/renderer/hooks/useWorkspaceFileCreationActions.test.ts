import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTranslator } from "../../shared/i18n";
import type { WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceFileCreationActions } from "./useWorkspaceFileCreationActions";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import { useWorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

describe("useWorkspaceFileCreationActions", () => {
  afterEach(() => {
    window.relic = undefined;
  });

  it("切替成功後に旧ワークスペースの作成が完了してもstateとタブへ適用しない", async () => {
    const created = deferred<RelicResult<WorkspaceState>>();
    const switched = deferred<RelicResult<WorkspaceState>>();
    const readMarkdownFile = vi.fn();
    const openFileInPane = vi.fn();
    const setWorkspaceState = vi.fn();
    window.relic = makeRelicApi({
      createMarkdownFile: vi.fn().mockReturnValue(created.promise),
      readMarkdownFile,
      switchWorkspace: vi.fn().mockReturnValue(switched.promise)
    });
    const stateA = workspaceState("workspace-a");
    const stateB = workspaceState("workspace-b");
    const { result } = renderHook(() => {
      const guard = useWorkspaceRequestGuard("workspace-a");
      const creationActions = useWorkspaceFileCreationActions({
        beginWorkspaceRequest: guard.beginWorkspaceRequest,
        focusedPane: "left",
        openFileInPane,
        setWorkspaceError: vi.fn(),
        setWorkspaceState,
        t: createTranslator("ja"),
        workspaceState: stateA
      });
      const registryActions = useWorkspaceRegistryActions({
        ...guard,
        activeWorkspaceId: "workspace-a",
        closeAllTabs: vi.fn(),
        setWorkspaceError: vi.fn(),
        setWorkspaceState
      });
      return { ...creationActions, ...registryActions };
    });

    act(() => {
      result.current.handleCreateNoteFromPane("Draft");
      result.current.handleSwitchWorkspace("workspace-b");
    });
    await act(async () => {
      switched.resolve({ ok: true, value: stateB });
      await Promise.resolve();
      created.resolve({ ok: true, value: stateA });
      await Promise.resolve();
    });

    expect(setWorkspaceState).toHaveBeenCalledTimes(1);
    expect(setWorkspaceState).toHaveBeenCalledWith(stateB);
    expect(readMarkdownFile).not.toHaveBeenCalled();
    expect(openFileInPane).not.toHaveBeenCalled();
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
