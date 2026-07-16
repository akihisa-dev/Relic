import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceChart, WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { apiContractMismatchMessage, isRelicApiContractCompatible, useWorkspaceCharts } from "./useWorkspaceCharts";
import { makeRelicApi } from "../../test/rendererTestUtils";
import type { RelicApi } from "../../shared/ipc";

describe("useWorkspaceCharts API contract", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("現行preload契約だけを互換として扱う", () => {
    const relic = makeRelicApi() as RelicApi;

    expect(isRelicApiContractCompatible(relic)).toBe(true);
    expect(isRelicApiContractCompatible({
      ...relic,
      apiContractVersion: 0
    } as unknown as RelicApi)).toBe(false);
    expect(apiContractMismatchMessage()).toContain("Relicを再起動");
  });

  it("チャート更新IPC例外時にrenderer側fallbackへ切り替えない", async () => {
    const relic = makeRelicApi({
      updateChartEntry: vi.fn().mockRejectedValue(new Error("ipc failed"))
    }) as RelicApi;

    await expect(relic.updateChartEntry({
      chronicleEntryIndex: 0,
      endValue: 1,
      kind: "move",
      originalEndValue: 1,
      originalStartValue: 1,
      path: "note.md",
      source: "chronicle",
      startValue: 1
    })).rejects.toThrow("ipc failed");
  });

  it("切替前のチャート完了を新しいワークスペースへ適用しない", async () => {
    const first = deferred<RelicResult<WorkspaceChart[]>>();
    const second = deferred<RelicResult<WorkspaceChart[]>>();
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    });
    const setWorkspaceError = vi.fn();
    const workspaceA = workspace("workspace-a");
    const workspaceB = workspace("workspace-b");

    const { result, rerender } = renderHook(
      ({ workspaceState }) => useWorkspaceCharts({
        hasOpenChart: true,
        setWorkspaceError,
        workspaceState
      }),
      { initialProps: { workspaceState: workspaceA } }
    );

    rerender({ workspaceState: workspaceB });
    await act(async () => second.resolve({ ok: true, value: [chart("chart-b")] }));
    await act(async () => first.resolve({ ok: true, value: [chart("chart-a")] }));

    expect(result.current.charts.flatMap((item) => item.filePaths)).toEqual(["chart-b.md"]);
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

function chart(id: string): WorkspaceChart {
  return { entries: [], filePaths: [`${id}.md`], id, name: id, source: "chronicle" };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}
