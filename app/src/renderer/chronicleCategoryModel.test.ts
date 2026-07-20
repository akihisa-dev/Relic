import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  CHRONICLE_UNCATEGORIZED_KEY,
  createChronicleCategoryOptions
} from "./chronicleCategoryModel";

function entry(path: string, category?: string): ChartEntry {
  return {
    ...(category === undefined ? {} : { category }),
    chronicleEntryIndex: 0,
    endLabel: "2",
    endPoint: { month: null, year: 2 },
    endValue: 2,
    fileName: path,
    path,
    startLabel: "1",
    startPoint: { month: null, year: 1 },
    startValue: 1
  };
}

describe("chronicleCategoryModel", () => {
  it("候補順、候補外、未分類の順に使用中カテゴリを集計する", () => {
    const entries = [
      entry("a.md", "人物"),
      entry("b.md", "戦争"),
      entry("c.md", "人物"),
      entry("d.md", "候補外"),
      entry("e.md")
    ];

    expect(createChronicleCategoryOptions(entries, ["戦争", "未使用", "人物"], "未分類")).toMatchObject([
      { count: 1, key: "category:戦争", label: "戦争" },
      { count: 2, key: "category:人物", label: "人物" },
      { count: 1, key: "category:候補外", label: "候補外" },
      { count: 1, key: CHRONICLE_UNCATEGORIZED_KEY, hue: null, label: "未分類" }
    ]);
  });

  it("11カテゴリへ重複しない安定した色相を割り当てる", () => {
    const entries = Array.from({ length: 11 }, (_, index) => entry(`${index}.md`, `カテゴリ${index + 1}`));
    const first = createChronicleCategoryOptions(entries, [], "未分類");
    const second = createChronicleCategoryOptions(entries.toReversed(), [], "未分類");
    const firstHues = first.map((option) => option.hue);

    expect(new Set(firstHues).size).toBe(11);
    expect(second.map((option) => option.hue)).toEqual(firstHues);
  });

});
