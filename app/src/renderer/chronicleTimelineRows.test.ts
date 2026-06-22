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
    chronicleCalendarId: "chronicle1",
    chronicleCalendarName: "王国暦",
    chronicleCalendarStartYear: 100,
    endLabel: "王国暦 5",
    endValue: 104,
    fileName: "王国史",
    path: "history/kingdom.md",
    startLabel: "王国暦 3",
    startValue: 102,
    ...overrides
  };
}

describe("chronicleTimelineRows", () => {
  it("年表の row key と暦patchを維持する", () => {
    const item = entry();

    expect(entryKey(item)).toBe("history/kingdom.md:chronicle1");
    expect(chronicleCalendarPatch(item)).toEqual({
      chronicleCalendarId: "chronicle1",
      chronicleCalendarStartYear: 100
    });
  });

  it("年表行はentryごとに作り、drag previewは対象entryだけを差し替える", () => {
    const item = entry();
    const other = entry({ chronicleCalendarId: "chronicle2", path: "history/other.md" });
    const rows = buildChartRows([item, other], "chronicle");
    const preview = {
      chronicleCalendarId: "chronicle1" as const,
      chronicleCalendarStartYear: 100,
      editKind: "move" as const,
      endValue: 106,
      path: "history/kingdom.md",
      source: "chronicle" as const,
      startValue: 105
    };

    expect(rows.map((row) => row.key)).toEqual(["history/kingdom.md:chronicle1", "history/other.md:chronicle2"]);
    expect(isPreviewForEntry(item, preview, "chronicle")).toBe(true);
    expect(isPreviewForEntry(other, preview, "chronicle")).toBe(false);
    expect(previewEntryForDrag(item, preview)).toMatchObject({
      endLabel: "王国暦 8",
      endValue: 106,
      startLabel: "王国暦 7",
      startValue: 105
    });
  });
});
