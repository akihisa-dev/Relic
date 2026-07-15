import { describe, expect, it } from "vitest";

import {
  parseSpherePerformanceArgs,
  percentile,
  summarize
} from "./sphere-performance-report.mjs";

describe("sphere-performance-report", () => {
  it("測定規模と実行回数を検証する", () => {
    expect(parseSpherePerformanceArgs(["--size", "large", "--runs", "5", "--cycles", "10"])).toMatchObject({
      cycles: 10,
      runs: 5,
      size: "large"
    });
    expect(() => parseSpherePerformanceArgs(["--size", "unknown"])).toThrow("Unknown argument");
    expect(() => parseSpherePerformanceArgs(["--runs", "0"])).toThrow("positive integer");
    expect(() => parseSpherePerformanceArgs(["--cycles", "-1"])).toThrow("non-negative integer");
  });

  it("中央値と遅い側の値を同じ規則で集計する", () => {
    expect(percentile([4, 1, 3, 2, 5], 0.5)).toBe(3);
    expect(summarize([4, 1, 3, 2, 5])).toEqual({ median: 3, p95: 5 });
    expect(summarize([])).toEqual({ median: 0, p95: 0 });
  });
});
