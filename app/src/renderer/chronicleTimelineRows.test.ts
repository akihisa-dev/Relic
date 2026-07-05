import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  buildChartRows,
  chronicleCalendarPatch,
  entryKey,
  isPreviewForEntry,
  previewEntryForDrag
} from "./chronicleTimelineRows";

function entry(overrides: Partial<ChartEntry> = {}): ChartEntry {
  return {
    chronicleCalendarName: "王国暦",
    chronicleCalendarStartYear: 100,
    chronicleEntryIndex: 1,
    endLabel: "王国暦 5",
    endValue: 1248,
    endPoint: { month: null, year: 5 },
    fileName: "王国史",
    path: "history/kingdom.md",
    startLabel: "王国暦 3",
    startPoint: { month: null, year: 3 },
    startValue: 1224,
    ...overrides
  };
}

describe("chronicleTimelineRows", () => {
  it("年表の row key と暦patchを維持する", () => {
    const item = entry();

    expect(entryKey(item)).toBe("history/kingdom.md:chronicle:1");
    expect(chronicleCalendarPatch(item)).toEqual({
      chronicleEntryIndex: 1
    });
  });

  it("年表行はentryごとに作り、drag previewは対象entryだけを差し替える", () => {
    const item = entry();
    const other = entry({ chronicleEntryIndex: 2, path: "history/other.md" });
    const rows = buildChartRows([item, other], "chronicle");
    const preview = {
      chronicleEntryIndex: 1,
      editKind: "move" as const,
      endValue: 1260,
      path: "history/kingdom.md",
      source: "chronicle" as const,
      startValue: 1248
    };

    expect(rows.map((row) => row.key)).toEqual(["history/kingdom.md:chronicle:1", "history/other.md:chronicle:2"]);
    expect(isPreviewForEntry(item, preview, "chronicle")).toBe(true);
    expect(isPreviewForEntry(other, preview, "chronicle")).toBe(false);
    expect(previewEntryForDrag(item, preview)).toMatchObject({
      endLabel: "王国暦 7-01",
      endValue: 1260,
      startLabel: "王国暦 6-01",
      startValue: 1248
    });
  });
});
