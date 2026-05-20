import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { GanttChartEntry, WorkspaceGanttChart } from "../../shared/ipc";
import { useUiStore } from "../store/uiStore";
import { buildChronicleVerticalViewportState, useChronicleChartModel } from "./useChronicleChartModel";

function entry(overrides: Partial<GanttChartEntry> = {}): GanttChartEntry {
  return {
    endLabel: "1333",
    endValue: 1332,
    fileName: "鎌倉時代",
    path: "history/kamakura.md",
    startLabel: "1185",
    startValue: 1184,
    ...overrides
  };
}

function chart(overrides: Partial<WorkspaceGanttChart> = {}): WorkspaceGanttChart {
  return {
    entries: [entry()],
    id: "chronicle",
    name: "chronicle",
    source: "chronicle",
    ...overrides
  };
}

describe("useChronicleChartModel", () => {
  beforeEach(() => {
    useUiStore.setState({ selectedGanttChartId: null });
  });

  it("selected id がない場合は先頭chartをfallbackにする", async () => {
    const chronicleChart = chart();
    const { result } = renderHook(() => useChronicleChartModel({
      chart: null,
      charts: [chronicleChart]
    }));

    expect(result.current.activeChart?.id).toBe("chronicle");

    await waitFor(() => {
      expect(useUiStore.getState().selectedGanttChartId).toBe("chronicle");
    });
  });

  it("chart選択時にstore選択と固定単位を維持する", () => {
    const chronicleChart = chart();
    const { result } = renderHook(() => useChronicleChartModel({
      chart: null,
      charts: [chronicleChart]
    }));

    act(() => {
      result.current.selectChart(chronicleChart);
    });

    expect(useUiStore.getState().selectedGanttChartId).toBe("chronicle");
    expect(result.current.activeSource).toBe("chronicle");
    expect(result.current.minimapItems).toHaveLength(1);
    expect(result.current.tickInterval).toBe(1);
    expect(result.current.axisHeight).toBe(34);
  });

  it("query と sort state からrowsを導出する", () => {
    const chronicleChart = chart({
      entries: [
        entry({
          endLabel: "1185",
          endValue: 1184,
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "1185",
          startValue: 1184
        }),
        entry({
          endLabel: "1333",
          endValue: 1332,
          fileName: "調査タスク",
          path: "tasks/research.md",
          startLabel: "1333",
          startValue: 1332
        })
      ],
      id: "chronicle",
      name: "Chronicle",
      source: "chronicle"
    });
    const { result } = renderHook(() => useChronicleChartModel({ chart: chronicleChart, charts: [] }));

    act(() => {
      result.current.setQuery("tasks");
      result.current.setSortKey("name-desc");
    });

    expect(result.current.rows.map((row) => row.path)).toEqual(["tasks/research.md", "tasks/implementation.md"]);
  });

  it("更新操作までは既存の行順を維持する", async () => {
    const firstChart = chart({
      entries: [
        entry({ fileName: "A", path: "a.md", startValue: 10, endValue: 10 }),
        entry({ fileName: "B", path: "b.md", startValue: 20, endValue: 20 })
      ],
      id: "chronicle",
      name: "chronicle",
      source: "chronicle"
    });
    const { rerender, result } = renderHook(
      ({ activeChart }) => useChronicleChartModel({ chart: activeChart, charts: [] }),
      { initialProps: { activeChart: firstChart } }
    );

    expect(result.current.rows.map((row) => row.path)).toEqual(["a.md", "b.md"]);

    act(() => {
      result.current.setSortKey("start-desc");
    });

    expect(result.current.rows.map((row) => row.path)).toEqual(["a.md", "b.md"]);

    act(() => {
      result.current.refreshRowOrder();
    });

    expect(result.current.rows.map((row) => row.path)).toEqual(["b.md", "a.md"]);

    rerender({
      activeChart: {
        ...firstChart,
        entries: [
          entry({ fileName: "A", path: "a.md", startValue: 30, endValue: 30 }),
          entry({ fileName: "B", path: "b.md", startValue: 5, endValue: 5 })
        ]
      }
    });

    await waitFor(() => {
      expect(result.current.rows.map((row) => row.path)).toEqual(["b.md", "a.md"]);
    });
  });

  it("縦方向の表示範囲と画面外件数を計算する", () => {
    expect(buildChronicleVerticalViewportState({
      axisHeight: 42,
      chartViewportHeight: 194,
      rowCount: 20,
      scrollTop: 38 * 5
    })).toEqual({
      verticalMinimapViewport: { heightPercent: 20, topPercent: 25 },
      verticalOffscreenIndicators: {
        bottom: { count: 11, targetIndex: 9 },
        top: { count: 5, targetIndex: 1 }
      }
    });
  });
});
