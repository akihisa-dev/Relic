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

  it("明示再取得中は年表を保ち、最新の完了だけを反映して成否を返す", async () => {
    const older = deferred<RelicResult<WorkspaceChart[]>>();
    const newer = deferred<RelicResult<WorkspaceChart[]>>();
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValueOnce({ ok: true, value: [chart("initial")] })
        .mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    });
    const setWorkspaceError = vi.fn();
    const workspaceState = workspace("workspace-a");
    const { result } = renderHook(() => useWorkspaceCharts({ hasOpenChart: true, setWorkspaceError, workspaceState }));
    await act(async () => undefined);
    let olderReload!: Promise<boolean>;
    let newerReload!: Promise<boolean>;
    act(() => { olderReload = result.current.reloadCharts(); newerReload = result.current.reloadCharts(); });
    expect(result.current.charts.flatMap((item) => item.filePaths)).toEqual(["initial.md"]);
    await act(async () => { newer.resolve({ ok: true, value: [chart("latest")] }); expect(await newerReload).toBe(true); });
    await act(async () => { older.resolve({ ok: false, error: { code: "OLD", message: "old failure" } }); expect(await olderReload).toBe(false); });
    expect(result.current.charts.flatMap((item) => item.filePaths)).toEqual(["latest.md"]);
    expect(setWorkspaceError).not.toHaveBeenCalled();
  });

  it("未表示時は自動取得せず、契約不一致は再取得失敗として通知する", async () => {
    const getWorkspaceCharts = vi.fn();
    window.relic = { ...makeRelicApi({ getWorkspaceCharts }), apiContractVersion: 0 } as unknown as RelicApi;
    const setWorkspaceError = vi.fn();
    const workspaceState = workspace("workspace-a");
    const { result } = renderHook(() => useWorkspaceCharts({ hasOpenChart: false, setWorkspaceError, workspaceState }));
    expect(getWorkspaceCharts).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.reloadCharts()).toBe(false); });
    expect(setWorkspaceError).toHaveBeenCalledWith(apiContractMismatchMessage());
    expect(getWorkspaceCharts).not.toHaveBeenCalled();
  });

  it("IPC transport rejection clears charts and reports a localized fallback", async () => {
    const setWorkspaceError = vi.fn();
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockRejectedValue(new Error("secret transport detail"))
    });

    const { result } = renderHook(() => useWorkspaceCharts({
      hasOpenChart: true,
      setWorkspaceError,
      workspaceState: workspace("workspace-a")
    }));

    await act(async () => undefined);

    expect(result.current.charts).toEqual([]);
    expect(setWorkspaceError).toHaveBeenCalled();
    expect(setWorkspaceError).not.toHaveBeenCalledWith(expect.stringContaining("secret transport detail"));
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
