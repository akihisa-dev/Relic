import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  buildChartRows,
  dateKindPatch,
  entryKey,
  isPreviewForEntry,
  previewEntryForDrag,
  statusLabelForEntry,
  statusValuesForEntries
} from "./chronicleTimelineRows";

function entry(overrides: Partial<ChartEntry> = {}): ChartEntry {
  return {
    endLabel: "2026-05-05",
    endValue: 20_848,
    fileName: "実装タスク",
    path: "tasks/implementation.md",
    startLabel: "2026-05-01",
    startValue: 20_844,
    ...overrides
  };
}

describe("chronicleTimelineRows", () => {
  it("row key、dateKind patch、status label の既存表現を維持する", () => {
    const planned = entry({ statuses: ["未着手", "", "進行中"] });
    const actual = entry({ dateKind: "actual" });

    expect(entryKey(planned)).toBe("tasks/implementation.md:default");
    expect(entryKey(actual)).toBe("tasks/implementation.md:actual");
    expect(dateKindPatch(planned)).toEqual({});
    expect(dateKindPatch(actual)).toEqual({ dateKind: "actual" });
    expect(statusLabelForEntry(planned)).toBe("未着手 / 進行中");
    expect(statusValuesForEntries([planned])).toEqual(["未着手", "進行中", "完了", "中断", "中止"]);
  });

  it("date rows は path ごとに集約し、planned を actual より前に置く", () => {
    const rows = buildChartRows([
      entry({ dateKind: "actual", statuses: ["完了"] }),
      entry({ dateKind: "planned", statuses: ["進行中"] })
    ], "date");

    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("tasks/implementation.md");
    expect(rows[0].statuses).toEqual(["完了", "進行中"]);
    expect(rows[0].entries.map((item) => item.dateKind)).toEqual(["planned", "actual"]);
  });

  it("drag preview は対象entryだけを差し替える", () => {
    const planned = entry();
    const actual = entry({ dateKind: "actual" });
    const preview = {
      dateKind: "planned" as const,
      editKind: "move" as const,
      endValue: 20_850,
      path: "tasks/implementation.md",
      source: "date" as const,
      startValue: 20_849
    };

    expect(isPreviewForEntry(planned, preview, "date")).toBe(true);
    expect(isPreviewForEntry(actual, preview, "date")).toBe(false);
    expect(previewEntryForDrag(planned, preview)).toMatchObject({
      endLabel: "2027-02-01",
      endValue: 20_850,
      startLabel: "2027-01-31",
      startValue: 20_849
    });
    expect(previewEntryForDrag(actual, preview)).toBe(actual);
  });
});
