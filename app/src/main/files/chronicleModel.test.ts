import { describe, expect, it } from "vitest";

import {
  calendarMainStartYear,
  calendarYearToMainYear,
  extractChronicleRangesFromData,
  formatCalendarPoint,
  mainYearToCalendarYear
} from "./chronicleModel";

describe("chronicleModel", () => {
  it("単年スカラーと年だけの期間を読む", () => {
    const calendars = [{ name: "メイン暦" }];

    expect(extractChronicleRangesFromData({ chronicle: 1185 }, calendars)[0]).toMatchObject({
      start: { month: null, year: 1185 },
      end: { month: null, year: 1185 }
    });
    expect(extractChronicleRangesFromData({ chronicle: { start: 1185, end: 1333 } }, calendars)[0]).toMatchObject({
      start: { month: null, year: 1185 },
      end: { month: null, year: 1333 }
    });
  });

  it("年だけの期間で0年、逆順、非整数を読まない", () => {
    const calendars = [{ name: "メイン暦" }];

    expect(extractChronicleRangesFromData({ chronicle: 0 }, calendars)).toEqual([]);
    expect(extractChronicleRangesFromData({ chronicle: { start: 2, end: 1 } }, calendars)).toEqual([]);
    expect(extractChronicleRangesFromData({ chronicle: { start: 1.5, end: 2 } }, calendars)).toEqual([]);
  });

  it("chronicle配列から複数の年月entryを読む", () => {
    const calendars = [
      { name: "王国暦" },
      { name: "帝国暦", startYear: 100 }
    ];

    expect(extractChronicleRangesFromData({
      chronicle: [
        ["王国暦", [[1185, null], [1333, null]]],
        ["帝国暦", [[-2, 5], [-1, 8]]]
      ]
    }, calendars)).toEqual([
      {
        calendar: calendars[0],
        calendarName: "王国暦",
        end: { month: null, year: 1333 },
        entryIndex: 0,
        start: { month: null, year: 1185 }
      },
      {
        calendar: calendars[1],
        calendarName: "帝国暦",
        end: { month: 8, year: -1 },
        entryIndex: 1,
        start: { month: 5, year: -2 }
      }
    ]);
  });

  it("壊れた構造、未登録暦、0年、不正月、逆順は読まない", () => {
    const calendars = [{ name: "王国暦" }];

    expect(extractChronicleRangesFromData({
      chronicle: [
        ["未登録", [[1, null], [1, null]]],
        ["王国暦", [[0, null], [1, null]]],
        ["王国暦", [[1, 13], [1, 13]]],
        ["王国暦", [[2, null], [1, null]]],
        [null, [[1, null], [1, null]]],
        ["王国暦", [1, 2]]
      ]
    }, calendars)).toEqual([]);
  });

  it("サブ暦年とメイン暦年を相互変換し、年月ラベルを整形する", () => {
    const calendar = { name: "帝国暦", startYear: 100 };

    expect(calendarMainStartYear(calendar)).toBe(100);
    expect(calendarYearToMainYear(calendar, 3)).toBe(102);
    expect(mainYearToCalendarYear(calendar, 102)).toBe(3);
    expect(formatCalendarPoint("帝国暦", { month: 5, year: -2 })).toBe("帝国暦 −2-05");
  });
});
