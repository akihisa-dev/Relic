import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  CHRONICLE_UNCATEGORIZED_KEY,
  chronicleCategoryKey,
  chronicleCategoryPaletteIndex,
  createChronicleCategoryOptions,
  isChronicleEntryVisible,
  pruneChronicleHiddenCategoryKeys
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

    expect(createChronicleCategoryOptions(entries, ["戦争", "未使用", "人物"], "未分類", 8)).toMatchObject([
      { count: 1, key: "category:戦争", label: "戦争" },
      { count: 2, key: "category:人物", label: "人物" },
      { count: 1, key: "category:候補外", label: "候補外" },
      { count: 1, key: CHRONICLE_UNCATEGORIZED_KEY, label: "未分類", paletteIndex: null }
    ]);
  });

  it("同じカテゴリ名から安定した色番号を求める", () => {
    expect(chronicleCategoryPaletteIndex("人物", 8)).toBe(chronicleCategoryPaletteIndex("人物", 8));
    expect(chronicleCategoryPaletteIndex("人物", 8)).toBeGreaterThanOrEqual(0);
    expect(chronicleCategoryPaletteIndex(undefined, 8)).toBeNull();
  });

  it("非表示カテゴリを描画対象から除外し、消えたカテゴリ状態を破棄する", () => {
    const war = entry("war.md", "戦争");
    const uncategorized = entry("note.md");
    const hidden = new Set([chronicleCategoryKey("戦争"), CHRONICLE_UNCATEGORIZED_KEY, "category:消滅"]);
    const options = createChronicleCategoryOptions([war, uncategorized], [], "未分類", 8);

    expect(isChronicleEntryVisible(war, hidden)).toBe(false);
    expect(isChronicleEntryVisible(uncategorized, hidden)).toBe(false);
    expect(pruneChronicleHiddenCategoryKeys(hidden, options)).toEqual([
      "category:戦争",
      CHRONICLE_UNCATEGORIZED_KEY
    ]);
  });
});
