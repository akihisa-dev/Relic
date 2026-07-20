import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  chronicleCalendarCategoryVisibilityKey,
  createChronicleCalendarHues,
  createChronicleCalendarTree
} from "./chronicleCalendarTreeModel";

function entry(fileName: string, path: string, calendarName?: string, category?: string): ChartEntry {
  return {
    ...(calendarName ? { calendarName } : {}),
    ...(category ? { category } : {}),
    chronicleEntryIndex: 0,
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
  it("暦を親、所属カテゴリを子として件数付きで設定順に構成する", () => {
    const tree = createChronicleCalendarTree([
      entry("王都.md", "王都.md", undefined, "地誌"),
      entry("七門攻防.md", "戦役/七門攻防.md", "灰王暦", "戦役"),
      entry("終戦.md", "戦役/終戦.md", "灰王暦", "戦役"),
      entry("記録.md", "記録.md", "灰王暦"),
      entry("対象外.md", "対象外.md", "未知暦", "人物")
    ], settings, ["戦役", "地誌"], "未分類");

    expect(tree.map((node) => node.calendarName)).toEqual(["基準暦", "灰王暦", "聖鐘暦"]);
    expect(tree[0].categories.map(({ count, label }) => ({ count, label }))).toEqual([{ count: 1, label: "地誌" }]);
    expect(tree[1].categories.map(({ count, label }) => ({ count, label }))).toEqual([
      { count: 2, label: "戦役" },
      { count: 1, label: "未分類" }
    ]);
    expect(tree[2].categories).toEqual([]);
  });

  it("暦とカテゴリの組を表示状態の識別子にする", () => {
    expect(chronicleCalendarCategoryVisibilityKey("基準暦", "category:戦役"))
      .not.toBe(chronicleCalendarCategoryVisibilityKey("灰王暦", "category:戦役"));
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
