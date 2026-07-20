import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import type { WorkspaceState } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { makeRelicApi } from "../../test/rendererTestUtils";
import { useWorkspaceChronicleCalendarSettings } from "./useWorkspaceChronicleCalendarSettings";

describe("useWorkspaceChronicleCalendarSettings", () => {
  afterEach(() => {
    window.relic = undefined;
    vi.clearAllMocks();
  });

  it("暦面設定の保存失敗時に楽観表示を保存前へ戻す", async () => {
    const before: ChronicleCalendarSettings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "別暦", range: null, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "別暦"]
    };
    const next: ChronicleCalendarSettings = {
      ...before,
      calendars: [{ name: "別暦", range: { end: 20, start: 1 }, yearOne: 100 }]
    };
    const save = deferred<RelicResult<ChronicleCalendarSettings>>();
    window.relic = makeRelicApi({
      getWorkspaceChronicleCalendarSettings: vi.fn().mockResolvedValue({ ok: true, value: before }),
      saveWorkspaceChronicleCalendarSettings: vi.fn().mockReturnValue(save.promise)
    });
    const setWorkspaceError = vi.fn();
    const { result } = renderHook(() => useWorkspaceChronicleCalendarSettings({
      onSaved: vi.fn(),
      setWorkspaceError,
      workspaceState: workspace("workspace-a")
    }));
    await act(async () => undefined);

    act(() => result.current.handleSaveCalendarSettings(next));
    expect(result.current.calendarSettings).toEqual(next);
    await act(async () => save.resolve({
      error: { code: "SAVE_FAILED", message: "保存できませんでした。" },
      ok: false
    }));

    expect(result.current.calendarSettings).toEqual(before);
    expect(setWorkspaceError).toHaveBeenLastCalledWith("保存できませんでした。");
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
