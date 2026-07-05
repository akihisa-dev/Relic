import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  buildChartRows,
  buildChronicleAxisSegments,
  buildGuideTicks,
  buildTicks,
  chronicleAxisTickInterval,
  chronicleNavigationTarget,
  chronicleSummaryForRow,
  createAdaptiveChroniclePointerDelta,
  createStablePointerDelta,
  filterRows,
  sortRows,
  timelineBounds,
  timelineOffscreenBarIndicators
} from "./chronicleTimeline";

function entry(overrides: Partial<ChartEntry> = {}): ChartEntry {
  return {
    endLabel: "1333",
    endValue: 1332,
    fileName: "鎌倉時代",
    chronicleCalendarName: "メイン暦",
    chronicleEntryIndex: 0,
    endPoint: { month: null, year: 1333 },
    path: "history/kamakura.md",
    startPoint: { month: null, year: 1185 },
    startLabel: "1185",
    startValue: 1184,
    ...overrides
  };
}

describe("chronicleTimeline", () => {
  it("年表の行生成と検索・並び替えを維持する", () => {
    const rows = buildChartRows([
      entry({ fileName: "B", path: "b.md", startValue: 20, endValue: 21 }),
      entry({ fileName: "A", path: "a.md", startValue: 10, endValue: 15 }),
      entry({ fileName: "A", path: "a-2.md", startValue: 10, endValue: 12 })
    ], "chronicle");

    expect(rows.map((row) => row.key)).toEqual(["b.md:chronicle:0", "a.md:chronicle:0", "a-2.md:chronicle:0"]);
    expect(filterRows(rows, "a-", "")).toHaveLength(1);
    expect(sortRows(rows, "start-asc").map((row) => row.path)).toEqual(["a-2.md", "a.md", "b.md"]);
    expect(sortRows(rows, "start-desc").map((row) => row.path)).toEqual(["b.md", "a.md", "a-2.md"]);
    expect(sortRows(rows, "name-asc").map((row) => row.path)).toEqual(["a-2.md", "a.md", "b.md"]);
    expect(chronicleSummaryForRow(rows[0])).toBe("メイン暦 1185-1333");
  });

  it("年表の bounds、ticks、axis segments、guide tick を計算する", () => {
    const bounds = timelineBounds([
      entry({ endValue: 1332, startValue: 1184 })
    ], 1);

    expect(bounds).toEqual({ axisEnd: 1355, axisStart: 1152 });
    expect(chronicleAxisTickInterval(1)).toBe(1);
    expect(buildTicks(bounds.axisStart, bounds.axisEnd, 1).slice(0, 3)).toEqual([
      1152,
      1164,
      1176
    ]);
    expect(buildGuideTicks(bounds.axisStart, bounds.axisEnd, [], 1).find((tick) => tick.value === 1188)).toEqual({
      isMajor: true,
      value: 1188
    });
    expect(buildChronicleAxisSegments(bounds.axisStart, bounds.axisEnd, 1)[0]).toEqual({
      endValue: 1163,
      label: "97",
      startValue: 1152
    });
  });

  it("年表の画面外表示と移動量を計算する", () => {
    const entries = [
      entry({ endValue: 20, path: "left.md", startValue: 10 }),
      entry({ endValue: 90, path: "right.md", startValue: 80 })
    ];

    expect(timelineOffscreenBarIndicators(entries, 30, 60)).toEqual({
      left: { count: 1, targetValue: 20 },
      right: { count: 1, targetValue: 80 }
    });
    expect(chronicleNavigationTarget(entries, 0, 99)).toBe(85);

    const stableDelta = createStablePointerDelta(0, 10);
    expect(stableDelta(6)).toBe(0);
    expect(stableDelta(7)).toBe(1);

    const slowChronicleDelta = createAdaptiveChroniclePointerDelta(0, 36, 0);
    for (let clientX = 1; clientX <= 72; clientX += 1) {
      slowChronicleDelta(clientX, clientX * 16);
    }
    expect(slowChronicleDelta(72, 72 * 16)).toBe(1);
  });
});
