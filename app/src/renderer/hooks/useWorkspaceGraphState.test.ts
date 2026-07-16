import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { resetWorkspaceGraphCache } from "../graph/workspaceGraphLoader";
import { useWorkspaceGraphState } from "./useWorkspaceGraphState";

describe("useWorkspaceGraphState", () => {
  afterEach(() => {
    resetWorkspaceGraphCache();
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("ワークスペース切替直後に旧グラフを隠し、切替前の完了を適用しない", async () => {
    const first = deferred<RelicResult<WorkspaceGraph>>();
    const second = deferred<RelicResult<WorkspaceGraph>>();
    const graphA = graph("A.md");
    const graphB = graph("B.md");
    window.relic = makeRelicApi({
      getWorkspaceGraph: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });

    const { result, rerender } = renderHook(
      ({ workspaceCacheKey }) => useWorkspaceGraphState({
        loadFailedMessage: "読み込めません",
        refreshRevision: 0,
        workspaceCacheKey
      }),
      { initialProps: { workspaceCacheKey: "workspace-a" } }
    );

    await act(async () => first.resolve({ ok: true, value: graphA }));
    expect(result.current.graph).toEqual(graphA);

    rerender({ workspaceCacheKey: "workspace-b" });
    expect(result.current).toMatchObject({ graph: null, loading: true });

    await act(async () => second.resolve({ ok: true, value: graphB }));
    expect(result.current.graph).toEqual(graphB);
  });
});

function graph(path: string): WorkspaceGraph {
  return {
    links: [],
    nodes: [{ backlinkCount: 0, exists: true, id: path, label: path, linkCount: 0, path, type: "file" }]
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
