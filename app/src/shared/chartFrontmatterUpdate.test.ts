import { describe, expect, it } from "vitest";

import { pointToMonthAxis } from "./chartTime";
import { updateChartFrontmatterContent } from "./chartFrontmatterUpdate";

describe("updateChartFrontmatterContent", () => {
  it("現行chronicle期間を年単位で書き戻す", () => {
    const result = updateChartFrontmatterContent(
      "---\ntitle: 鎌倉時代\nchronicle: { start: 10, end: 12 }\ntags: [資料]\n---\n# 本文",
      {
        chronicleEntryIndex: 0,
        endValue: pointToMonthAxis(13, 1),
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
    expect(result.value).toContain("chronicle:\n  calendar: 基準暦\n  start: 11\n  end: 13");
    expect(result.value).toContain("tags: [資料]");
    expect(result.value).toContain("# 本文");
  });

  it("旧暦配列は書き換えずに保持する", () => {
    const result = updateChartFrontmatterContent(
      "---\nchronicle:\n  - [旧暦, [[1, null], [1, null]]]\n---\n# 本文",
      {
        chronicleEntryIndex: 0,
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
