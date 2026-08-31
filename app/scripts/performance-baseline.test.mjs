import { describe, expect, it } from "vitest";

import {
  assertPerformanceBaselineComparable,
  compareLowerIsBetterMetrics,
  currentPerformanceEnvironment,
  median,
  performanceBaselineCompatibilityErrors,
  renderComparison
} from "./performance-baseline.mjs";

const comparableReport = {
  environment: { arch: "arm64", nodeMajor: 26, platform: "darwin" },
  fixture: { directoryCount: 20, fileCount: 1000, fingerprint: "fixture-a" },
  host: { cpu: "host-specific model" },
  runs: 5,
  warmups: 1
};

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

  it("Node major、platform、archを比較可能性metadataとして返す", () => {
    expect(currentPerformanceEnvironment({
      arch: "arm64",
      nodeVersion: "26.4.0",
      platform: "darwin"
    })).toEqual({ arch: "arm64", nodeMajor: 26, platform: "darwin" });
  });

  it("同じfixtureと実行条件を比較可能として扱いCPU名は一致必須にしない", () => {
    const baseline = structuredClone(comparableReport);
    baseline.host.cpu = "different host-specific model";

    expect(performanceBaselineCompatibilityErrors(comparableReport, baseline)).toEqual([]);
    expect(() => assertPerformanceBaselineComparable(comparableReport, baseline)).not.toThrow();
  });

  it.each([
    ["fixture.fingerprint", "fixture-b"],
    ["fixture.fileCount", 999],
    ["fixture.directoryCount", 19],
    ["environment.nodeMajor", 25],
    ["environment.platform", "linux"],
    ["environment.arch", "x64"],
    ["runs", 4],
    ["warmups", 0]
  ])("%sが異なるbaselineを比較不能として明示する", (field, value) => {
    const baseline = structuredClone(comparableReport);
    const keys = field.split(".");
    const target = keys.slice(0, -1).reduce((current, key) => current[key], baseline);
    target[keys.at(-1)] = value;

    expect(performanceBaselineCompatibilityErrors(comparableReport, baseline)).toEqual([
      expect.stringContaining(`metadata mismatch for ${field}`)
    ]);
    expect(() => assertPerformanceBaselineComparable(comparableReport, baseline)).toThrow(
      `Performance baseline metadata mismatch for ${field}`
    );
  });
});
