import { describe, expect, it } from "vitest";

import type { GanttChartEntry } from "../shared/ipc";
import {
  DATE_SCALES,
  buildChartRows,
  buildChronicleAxisSegments,
  buildDateAxisSegments,
  buildGuideTicks,
  buildTicks,
  chronicleAxisTickInterval,
  chronicleNavigationTarget,
  chronicleSummaryForRow,
  createAdaptiveChroniclePointerDelta,
  createStablePointerDelta,
  dateNavigationTarget,
  dateOffscreenBarIndicators,
  dateSummaryForRow,
  filterRows,
  formatRange,
  minimapItemsForEntries,
  minimapViewportRange,
  sortRows,
  timelineBounds,
  timelineOffscreenBarIndicators
} from "./chronicleTimeline";

const day = (value: string): number =>
  Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);

function entry(overrides: Partial<GanttChartEntry>): GanttChartEntry {
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

describe("chronicleTimeline", () => {
  it("chronicle/date の行生成と date planned/actual の集約順を維持する", () => {
    const chronicleRows = buildChartRows([
      entry({ path: "history/kamakura.md" }),
      entry({ fileName: "平安時代", path: "history/heian.md" })
    ], "chronicle");

    expect(chronicleRows.map((row) => row.key)).toEqual([
      "history/kamakura.md:default",
      "history/heian.md:default"
    ]);

    const actual = entry({
      dateKind: "actual",
      endLabel: "2026-05-06",
      endValue: day("2026-05-06"),
      fileName: "実装タスク",
      path: "tasks/implementation.md",
      startLabel: "2026-05-03",
      startValue: day("2026-05-03"),
      statuses: ["完了"]
    });
    const planned = entry({
      dateKind: "planned",
      endLabel: "2026-05-05",
      endValue: day("2026-05-05"),
      fileName: "実装タスク",
      path: "tasks/implementation.md",
      startLabel: "2026-05-01",
      startValue: day("2026-05-01"),
      statuses: ["未着手", "完了"]
    });

    const dateRows = buildChartRows([actual, planned], "date");

    expect(dateRows).toHaveLength(1);
    expect(dateRows[0].key).toBe("tasks/implementation.md");
    expect(dateRows[0].statuses).toEqual(["完了", "未着手"]);
    expect(dateRows[0].entries.map((item) => item.dateKind)).toEqual(["planned", "actual"]);
    expect(dateSummaryForRow(dateRows[0], "planned")).toBe("05/01-05/05");
    expect(dateSummaryForRow(dateRows[0], "actual")).toBe("05/03-05/06");
  });

  it("query/status filter と start/name sort の既存順序を維持する", () => {
    const rows = buildChartRows([
      entry({ fileName: "B", path: "b.md", startValue: 20, endValue: 21, statuses: ["未着手"] }),
      entry({ fileName: "A", path: "a.md", startValue: 10, endValue: 15, statuses: ["完了"] }),
      entry({ fileName: "A", path: "a-2.md", startValue: 10, endValue: 12, statuses: ["進行中"] })
    ], "chronicle");

    expect(filterRows(rows, "a-", "")).toHaveLength(1);
    expect(filterRows(rows, "", "完了")).toHaveLength(1);
    expect(sortRows(rows, "start-asc").map((row) => row.path)).toEqual(["a-2.md", "a.md", "b.md"]);
    expect(sortRows(rows, "start-desc").map((row) => row.path)).toEqual(["b.md", "a.md", "a-2.md"]);
    expect(sortRows(rows, "name-asc").map((row) => row.path)).toEqual(["a-2.md", "a.md", "b.md"]);
    expect(chronicleSummaryForRow(rows[0])).toBe("21-22");
  });

  it("chronicle の bounds、ticks、axis segments、guide tick を計算する", () => {
    const bounds = timelineBounds([
      entry({ endValue: 1332, startValue: 1184 })
    ], 1, "chronicle", null);

    expect(bounds).toEqual({ axisEnd: 1342, axisStart: 1174 });
    expect(chronicleAxisTickInterval(1)).toBe(1);
    expect(buildTicks(bounds.axisStart, bounds.axisEnd, 1, "chronicle", null).slice(0, 3)).toEqual([
      1174,
      1175,
      1176
    ]);
    expect(buildGuideTicks(bounds.axisStart, bounds.axisEnd, [], 1, "chronicle", null).find((tick) => tick.value === 1189)).toEqual({
      isMajor: true,
      value: 1189
    });
    expect(buildChronicleAxisSegments(bounds.axisStart, bounds.axisEnd, 1)[0]).toEqual({
      endValue: 1174,
      label: "1175",
      startValue: 1174
    });
  });

  it("date の bounds、ticks、axis segments、guide tick を計算する", () => {
    const dateScale = DATE_SCALES[0];
    const dateEntry = entry({
      dateKind: "planned",
      endLabel: "2026-06-20",
      endValue: day("2026-06-20"),
      startLabel: "2026-05-01",
      startValue: day("2026-05-01")
    });
    const bounds = timelineBounds([dateEntry], 1, "date", dateScale);

    expect(bounds.axisStart).toBeLessThanOrEqual(dateEntry.startValue);
    expect(bounds.axisEnd).toBeGreaterThanOrEqual(dateEntry.endValue);
    expect(buildTicks(day("2026-05-01"), day("2026-05-03"), 1, "date", DATE_SCALES[0])).toEqual([
      day("2026-05-01"),
      day("2026-05-02"),
      day("2026-05-03")
    ]);
    const guideTicks = buildTicks(day("2026-05-01"), day("2026-06-02"), 1, "date", dateScale);
    expect(buildGuideTicks(day("2026-05-01"), day("2026-06-02"), guideTicks, 1, "date", dateScale).find((tick) => tick.value === day("2026-06-01"))).toEqual({
      isMajor: true,
      value: day("2026-06-01")
    });
    expect(buildDateAxisSegments(day("2026-05-15"), day("2026-06-02"), "month")).toEqual([
      { endValue: day("2026-05-31"), label: "05", startValue: day("2026-05-15") },
      { endValue: day("2026-06-02"), label: "06", startValue: day("2026-06-01") }
    ]);
    expect(formatRange(dateEntry, "date", DATE_SCALES[0])).toBe("01 〜 20");
  });

  it("offscreen indicators、minimap、navigation target を計算する", () => {
    const entries = [
      entry({ endValue: 20, path: "left.md", startValue: 10 }),
      entry({ endValue: 90, path: "right.md", startValue: 80 })
    ];

    expect(timelineOffscreenBarIndicators(entries, 30, 60)).toEqual({
      left: { count: 1, targetValue: 20 },
      right: { count: 1, targetValue: 80 }
    });
    expect(dateOffscreenBarIndicators(entries, 30, 60)).toEqual({
      left: { count: 1, targetValue: 20 },
      right: { count: 1, targetValue: 80 }
    });
    expect(minimapItemsForEntries(entries, 0, 99)).toEqual([
      { key: "left.md:default", leftPercent: 10, widthPercent: 11 },
      { key: "right.md:default", leftPercent: 80, widthPercent: 11 }
    ]);
    expect(minimapViewportRange(0, 99, 20, 40)).toEqual({ leftPercent: 20, widthPercent: 20 });
    expect(chronicleNavigationTarget(entries, 0, 99)).toBe(85);
    expect(dateNavigationTarget(entries, 0, 1)).toBe(80);
  });

  it("stable/adaptive drag delta の既存挙動を維持する", () => {
    const stableDelta = createStablePointerDelta(0, 10);
    expect(stableDelta(6)).toBe(0);
    expect(stableDelta(7)).toBe(1);

    const slowChronicleDelta = createAdaptiveChroniclePointerDelta(0, 36, 0);
    for (let clientX = 1; clientX <= 72; clientX += 1) {
      slowChronicleDelta(clientX, clientX * 16);
    }
    expect(slowChronicleDelta(72, 72 * 16)).toBe(1);

    const fastChronicleDelta = createAdaptiveChroniclePointerDelta(0, 36, 0);
    expect(fastChronicleDelta(72, 16)).toBe(3);
  });
});
