import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceSearchState } from "./useWorkspaceSearchState";

describe("useWorkspaceSearchState", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("ワークスペース切替直後に前のフロントマター候補を返さない", async () => {
    const first = deferred<RelicResult<Record<string, string[]>>>();
    const second = deferred<RelicResult<Record<string, string[]>>>();
    window.relic = makeRelicApi({
      getFrontmatterValueCandidates: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });
    const setWorkspaceError = vi.fn();
    const workspaceA = workspace("workspace-a");
    const workspaceB = workspace("workspace-b");

    const { result, rerender } = renderHook(
      ({ workspaceState }) => useWorkspaceSearchState({
        setWorkspaceError,
        userDefinedFields: [],
        workspaceState
      }),
      { initialProps: { workspaceState: workspaceA } }
    );

    await act(async () => first.resolve({ ok: true, value: { status: ["Alpha"] } }));
    expect(result.current.frontmatterCandidates).toEqual({ status: ["Alpha"] });

    rerender({ workspaceState: workspaceB });
    expect(result.current.frontmatterCandidates).toEqual({});

    await act(async () => second.resolve({ ok: true, value: { status: ["Beta"] } }));
    expect(result.current.frontmatterCandidates).toEqual({ status: ["Beta"] });
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
