import { describe, expect, it } from "vitest";

import { pointToMonthAxis } from "./chartTime";
import { updateChartFrontmatterContent } from "./chartFrontmatterUpdate";

describe("updateChartFrontmatterContent", () => {
  it("複数chronicle entryのうち対象entryだけを月単位で書き戻す", () => {
    const result = updateChartFrontmatterContent(
      [
        "---",
        "title: 鎌倉時代",
        "chronicle:",
        "  - [メイン暦, [[1, null], [1, null]]]",
        "  - [メイン暦, [[10, null], [12, null]]]",
        "tags: [資料]",
        "---",
        "# 本文"
      ].join("\n"),
      {
        chronicleEntryIndex: 1,
        endValue: pointToMonthAxis(12, 1),
        kind: "resize-start",
        originalEndValue: pointToMonthAxis(12, null),
        originalStartValue: pointToMonthAxis(10, null),
        path: "history/kamakura.md",
        source: "chronicle",
        startValue: pointToMonthAxis(11, 3)
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toContain("[メイン暦, [[1, null], [1, null]]]");
    expect(result.value).toContain("[メイン暦, [[11, 3], [12, 1]]]");
    expect(result.value).toContain("tags: [資料]");
    expect(result.value).toContain("# 本文");
  });

  it("存在しないchronicle entry indexは書き戻さない", () => {
    const result = updateChartFrontmatterContent(
      "---\nchronicle:\n  - [メイン暦, [[1, null], [1, null]]]\n---\n# 本文",
      {
        chronicleEntryIndex: 3,
        endValue: pointToMonthAxis(2, 1),
        kind: "resize-end",
        originalEndValue: pointToMonthAxis(1, null),
        originalStartValue: pointToMonthAxis(1, null),
        path: "history/kamakura.md",
        source: "chronicle",
        startValue: pointToMonthAxis(1, 1)
      }
    );

    expect(result).toMatchObject({
      error: { code: "CHART_CHRONICLE_ENTRY_MISSING" },
      ok: false
    });
  });
});
