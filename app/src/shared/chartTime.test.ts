import { describe, expect, it } from "vitest";

import {
  monthAxisToYear,
  pointToMonthAxis
} from "./chartTime";

describe("chartTime", () => {
  it("0年を作らず紀元前から紀元後へ連続する軸へ変換する", () => {
    expect(pointToMonthAxis(-1, 1)).toBe(-12);
    expect(pointToMonthAxis(1, 1)).toBe(0);
    expect(pointToMonthAxis(2, 1)).toBe(12);
    expect(monthAxisToYear(-1)).toBe(-1);
    expect(monthAxisToYear(0)).toBe(1);
    expect(monthAxisToYear(12)).toBe(2);
  });

  it("月を省略した年と年末の月を同じ年へ戻す", () => {
    for (const year of [-5, -1, 1, 5]) {
      expect(monthAxisToYear(pointToMonthAxis(year, null))).toBe(year);
      expect(monthAxisToYear(pointToMonthAxis(year, 12))).toBe(year);
    }
  });
});
