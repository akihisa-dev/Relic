import { describe, expect, it } from "vitest";

import type { TimelineChartEntry } from "../shared/ipc";
import {
  buildChartRows,
  entryKey,
  isPreviewForEntry,
  previewEntryForDrag,
  statusLabelForEntry,
  statusValuesForEntries
} from "./timelineTimelineRows";

function entry(overrides: Partial<TimelineChartEntry> = {}): TimelineChartEntry {
  return {
    endLabel: "2026-05-05",
    endValue: 20_848,
    cardName: "実装タスク",
    path: "tasks/implementation.md",
    startLabel: "2026-05-01",
    startValue: 20_844,
    ...overrides
  };
}

describe("timelineTimelineRows", () => {
  it("row key と status label の既存表現を維持する", () => {
    const current = entry({ statuses: ["未着手", "", "進行中"] });

    expect(entryKey(current)).toBe("tasks/implementation.md");
    expect(statusLabelForEntry(current)).toBe("未着手 / 進行中");
    expect(statusValuesForEntries([current])).toEqual(["未着手", "進行中", "完了", "中断", "中止"]);
  });

  it("timeline rows は entry ごとに作る", () => {
    const rows = buildChartRows([
      entry({ path: "tasks/a.md", statuses: ["完了"] }),
      entry({ path: "tasks/b.md", statuses: ["進行中"] })
    ], "timeline");

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.key)).toEqual(["tasks/a.md", "tasks/b.md"]);
  });

  it("drag preview は対象entryだけを差し替える", () => {
    const current = entry();
    const other = entry({ path: "tasks/other.md" });
    const preview = {
      endValue: 20_846,
      path: "tasks/implementation.md",
      source: "timeline" as const,
      startValue: 20_845
    };

    expect(isPreviewForEntry(current, preview, "timeline")).toBe(true);
    expect(isPreviewForEntry(other, preview, "timeline")).toBe(false);
    expect(previewEntryForDrag(current, preview)).toMatchObject({
      endValue: 20_846,
      startValue: 20_845
    });
    expect(previewEntryForDrag(other, preview)).toBe(other);
  });
});
