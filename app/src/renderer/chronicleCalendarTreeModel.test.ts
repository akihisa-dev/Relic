import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import { createChronicleCalendarHues, createChronicleCalendarTree } from "./chronicleCalendarTreeModel";

function entry(fileName: string, path: string, calendarName?: string, chronicleEntryIndex = 0): ChartEntry {
  return {
    ...(calendarName ? { calendarName } : {}),
    chronicleEntryIndex,
    endLabel: "1",
    endPoint: { month: null, year: 1 },
    endValue: 1,
    fileName,
    path,
    startLabel: "1",
    startPoint: { month: null, year: 1 },
    startValue: 1
  };
}

const settings = {
  baseCalendarName: "基準暦",
  calendars: [
    { name: "灰王暦", range: { end: 40, start: 1 }, yearOne: 100 },
    { name: "聖鐘暦", range: { end: 20, start: 1 }, yearOne: 200 }
  ],
  visibleCalendarNames: ["基準暦", "灰王暦", "聖鐘暦"]
};

describe("chronicleCalendarTreeModel", () => {
  it("暦を親、重複を除いた所属ファイルを子として設定順に構成する", () => {
    const tree = createChronicleCalendarTree([
      entry("王都.md", "王都.md"),
      entry("七門攻防.md", "戦役/七門攻防.md", "灰王暦"),
      entry("七門攻防.md", "戦役/七門攻防.md", "灰王暦", 1),
      entry("対象外.md", "対象外.md", "未知暦")
    ], settings);

    expect(tree.map((node) => node.calendarName)).toEqual(["基準暦", "灰王暦", "聖鐘暦"]);
    expect(tree[0].files).toEqual([{ fileName: "王都.md", path: "王都.md" }]);
    expect(tree[1].files).toEqual([{ fileName: "七門攻防.md", path: "戦役/七門攻防.md" }]);
    expect(tree[2].files).toEqual([]);
  });

  it("追加暦名ごとに設定順へ依存しない異なる色相を割り当てる", () => {
    const reversed = { ...settings, calendars: [...settings.calendars].reverse() };
    const hues = createChronicleCalendarHues(settings);
    const reversedHues = createChronicleCalendarHues(reversed);

    expect(new Set(hues.values()).size).toBe(2);
    expect(reversedHues.get("灰王暦")).toBe(hues.get("灰王暦"));
    expect(reversedHues.get("聖鐘暦")).toBe(hues.get("聖鐘暦"));
  });
});
