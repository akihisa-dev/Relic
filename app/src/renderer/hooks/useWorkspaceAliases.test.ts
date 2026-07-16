import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceAliases } from "./useWorkspaceAliases";

describe("useWorkspaceAliases", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("ワークスペース切替直後に前の別名索引を返さない", async () => {
    const first = deferred<RelicResult<AliasIndex>>();
    const second = deferred<RelicResult<AliasIndex>>();
    window.relic = makeRelicApi({
      getWorkspaceAliases: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });
    const setWorkspaceError = vi.fn();
    const workspaceA = workspace("workspace-a");
    const workspaceB = workspace("workspace-b");

    const { result, rerender } = renderHook(
      ({ workspaceState }) => useWorkspaceAliases({
        setWorkspaceError,
        workspaceState
      }),
      { initialProps: { workspaceState: workspaceA } }
    );

    await act(async () => first.resolve({ ok: true, value: { "A.md": ["Alpha"] } }));
    expect(result.current).toEqual({ "A.md": ["Alpha"] });

    rerender({ workspaceState: workspaceB });
    expect(result.current).toEqual({});

    await act(async () => second.resolve({ ok: true, value: { "B.md": ["Beta"] } }));
    expect(result.current).toEqual({ "B.md": ["Beta"] });
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
