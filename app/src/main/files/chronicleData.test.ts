import { describe, expect, it } from "vitest";

import { collectChartEntriesForMarkdown, extractFrontmatterCategory } from "./chronicleData";

describe("chronicleData", () => {
  it("有効なchronicleエントリごとにcategoryを付与する", () => {
    const entries = collectChartEntriesForMarkdown("history/kamakura.md", `---
category: 戦争
chronicle:
  - [メイン暦, [[1185, null], [1185, null]]]
  - [メイン暦, [[1192, null], [1192, null]]]
---
# 鎌倉
`).chronicle;

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => ({
      category: entry.category,
      chronicleEntryIndex: entry.chronicleEntryIndex,
      fileName: entry.fileName,
      path: entry.path
    }))).toEqual([
      { category: "戦争", chronicleEntryIndex: 0, fileName: "kamakura", path: "history/kamakura.md" },
      { category: "戦争", chronicleEntryIndex: 1, fileName: "kamakura", path: "history/kamakura.md" }
    ]);
  });

  it("categoryが未設定または文字列以外の場合は表示データに付けない", () => {
    expect(extractFrontmatterCategory({})).toBeNull();
    expect(extractFrontmatterCategory({ category: "" })).toBeNull();
    expect(extractFrontmatterCategory({ category: ["戦争"] })).toBeNull();
  });
}
);
