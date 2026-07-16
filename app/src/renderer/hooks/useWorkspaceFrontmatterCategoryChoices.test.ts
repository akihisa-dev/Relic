import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FrontmatterCategoryChoice, WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceFrontmatterCategoryChoices } from "./useWorkspaceFrontmatterCategoryChoices";

describe("useWorkspaceFrontmatterCategoryChoices", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("ワークスペース切替時に旧候補を隠し、切替前の保存完了を適用しない", async () => {
    const loadA = deferred<RelicResult<FrontmatterCategoryChoice[]>>();
    const loadB = deferred<RelicResult<FrontmatterCategoryChoice[]>>();
    const saveA = deferred<RelicResult<FrontmatterCategoryChoice[]>>();
    window.relic = makeRelicApi({
      getWorkspaceFrontmatterCategoryChoices: vi.fn()
        .mockReturnValueOnce(loadA.promise)
        .mockReturnValueOnce(loadB.promise),
      saveWorkspaceFrontmatterCategoryChoices: vi.fn().mockReturnValue(saveA.promise)
    });
    const setWorkspaceError = vi.fn();
    const workspaceA = workspace("workspace-a");
    const workspaceB = workspace("workspace-b");

    const { result, rerender } = renderHook(
      ({ workspaceState }) => useWorkspaceFrontmatterCategoryChoices({
        setWorkspaceError,
        workspaceState
      }),
      { initialProps: { workspaceState: workspaceA } }
    );

    await act(async () => loadA.resolve({ ok: true, value: ["Alpha"] }));
    act(() => result.current.handleSaveCategoryChoices(["Saved A"]));
    expect(result.current.categoryChoices).toEqual(["Saved A"]);

    rerender({ workspaceState: workspaceB });
    expect(result.current.categoryChoices).toEqual([]);

    await act(async () => loadB.resolve({ ok: true, value: ["Beta"] }));
    await act(async () => saveA.resolve({ ok: true, value: ["Late A"] }));
    expect(result.current.categoryChoices).toEqual(["Beta"]);
  });
});

function workspace(id: string): WorkspaceState {
  return {
    activeWorkspace: { id, name: id, path: `/tmp/${id}` },
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
