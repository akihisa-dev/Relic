import { describe, expect, it } from "vitest";

import { extractChronicleRangesFromData, formatPoint } from "./chronicleModel";

describe("chronicleModel", () => {
  it("単年スカラーと年だけの期間を読む", () => {
    expect(extractChronicleRangesFromData({ chronicle: 1185 })[0]).toMatchObject({
      start: { month: null, year: 1185 },
      end: { month: null, year: 1185 }
    });
    expect(extractChronicleRangesFromData({ chronicle: { start: 1185, end: 1333 } })[0]).toMatchObject({
      start: { month: null, year: 1185 },
      end: { month: null, year: 1333 }
    });
  });

  it("旧暦配列、0年、逆順、非整数を読まない", () => {
    expect(extractChronicleRangesFromData({ chronicle: [["旧暦", [[1, null], [2, null]]]] })).toEqual([]);
    expect(extractChronicleRangesFromData({ chronicle: 0 })).toEqual([]);
    expect(extractChronicleRangesFromData({ chronicle: { start: 2, end: 1 } })).toEqual([]);
    expect(extractChronicleRangesFromData({ chronicle: { start: 1.5, end: 2 } })).toEqual([]);
  });

  it("正負の年を整形する", () => {
    expect(formatPoint({ month: null, year: 1185 })).toBe("1185");
    expect(formatPoint({ month: null, year: -2 })).toBe("−2");
  });
});
