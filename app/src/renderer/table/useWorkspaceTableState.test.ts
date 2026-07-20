import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultWorkspaceTablePreferences, type WorkspaceTable } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { resetWorkspaceTableCache } from "./workspaceTableLoader";
import { useWorkspaceTableState } from "./useWorkspaceTableState";

describe("useWorkspaceTableState", () => {
  afterEach(() => {
    resetWorkspaceTableCache();
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("ワークスペース切替直後に旧テーブルを隠し、遅れて完了した旧要求を反映しない", async () => {
    const first = deferred<RelicResult<WorkspaceTable>>();
    const second = deferred<RelicResult<WorkspaceTable>>();
    window.relic = makeRelicApi({
      getWorkspaceTable: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });

    const { result, rerender } = renderHook(
      ({ workspaceId }) => useWorkspaceTableState({
        loadFailedMessage: "読み込めません",
        refreshRevision: 0,
        workspaceId
      }),
      { initialProps: { workspaceId: "workspace-a" } }
    );

    rerender({ workspaceId: "workspace-b" });
    expect(result.current).toEqual({ status: "loading" });

    await act(async () => first.resolve({ ok: true, value: table("A.md") }));
    expect(result.current).toEqual({ status: "loading" });

    await act(async () => second.resolve({ ok: true, value: table("B.md") }));
    expect(result.current).toMatchObject({ status: "ready", table: table("B.md") });
  });
});

function table(path: string): WorkspaceTable {
  return {
    availableProperties: [],
    preferences: defaultWorkspaceTablePreferences,
    rows: [{ frontmatterStatus: "none", name: path, path, properties: {} }],
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
