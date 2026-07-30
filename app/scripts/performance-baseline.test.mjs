import { describe, expect, it } from "vitest";

import {
  compareLowerIsBetterMetrics,
  median,
  renderComparison
} from "./performance-baseline.mjs";

describe("performance-baseline", () => {
  it("奇数と偶数のサンプルから中央値を返す", () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([9, 1, 7, 3])).toBe(5);
  });

  it("許容率を超えた増加と新規メトリクスを回帰として検出する", () => {
    const comparison = compareLowerIsBetterMetrics(
      { improved: 80, newChunk: 10, regressed: 116 },
      { improved: 100, regressed: 100 },
      15
    );

    expect(comparison.regressions.map((entry) => entry.metric)).toEqual(["newChunk", "regressed"]);
    expect(renderComparison(comparison)).toContain("2 regression(s) detected.");
  });

  it("基準値と同値または許容率以内の増加を成功とする", () => {
    const comparison = compareLowerIsBetterMetrics({ duration: 115 }, { duration: 100 }, 15);
    expect(comparison.regressions).toEqual([]);
  });

  it("基準に存在する計測項目の欠落を失敗として表示する", () => {
    const comparison = compareLowerIsBetterMetrics(
      { collected: 80 },
      { collected: 100, silentlyMissing: 50 },
      15
    );

    expect(comparison.missingMetrics.map((entry) => entry.metric)).toEqual(["silentlyMissing"]);
    expect(comparison.regressions.map((entry) => entry.metric)).toEqual(["silentlyMissing"]);
    expect(renderComparison(comparison)).toContain("MISSING\t50\t-\tmissing\tsilentlyMissing");
  });
});
