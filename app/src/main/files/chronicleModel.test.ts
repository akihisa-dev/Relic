import { describe, expect, it } from "vitest";

import {
  calendarMainStartYear,
  calendarYearToMainYear,
  extractDateRangeFromData,
  extractFirstChronicleRangeFromData,
  formatCalendarYear,
  mainYearToCalendarYear,
  normalizeDateFieldsForWrite
} from "./chronicleModel";

describe("chronicleModel", () => {
  it("chronicle0は1以上、サブ暦は0以下を含む整数として読む", () => {
    const calendars = [
      { id: "chronicle0" as const, name: "王国暦" },
      { id: "chronicle1" as const, name: "帝国暦", startYear: 100 }
    ];

    expect(extractFirstChronicleRangeFromData({ chronicle0: [0], chronicle1: [-2, 0] }, calendars)).toEqual({
      calendar: calendars[1],
      endYear: 0,
      startYear: -2
    });
    expect(extractFirstChronicleRangeFromData({ chronicle0: [1] }, calendars)).toEqual({
      calendar: calendars[0],
      endYear: 1,
      startYear: 1
    });
  });

  it("未設定サブ暦は年表対象にせず、暦名なしはidで表示する", () => {
    expect(extractFirstChronicleRangeFromData(
      { chronicle1: [5], chronicle2: [2] },
      [
        { id: "chronicle0", name: "王国暦" },
        { id: "chronicle1", name: "未開始暦" },
        { id: "chronicle2", name: "", startYear: 200 }
      ]
    )).toEqual({
      calendar: { id: "chronicle2", name: "", startYear: 200 },
      endYear: 2,
      startYear: 2
    });
    expect(formatCalendarYear({ id: "chronicle2", name: "", startYear: 200 }, -1)).toBe("chronicle2 −1");
  });

  it("サブ暦年とメイン暦年を相互変換する", () => {
    const calendar = { id: "chronicle1" as const, name: "帝国暦", startYear: 100 };

    expect(calendarMainStartYear(calendar)).toBe(100);
    expect(calendarYearToMainYear(calendar, 3)).toBe(102);
    expect(mainYearToCalendarYear(calendar, 102)).toBe(3);
  });

  it("日付範囲を単日、期間、OS由来文字列から読む", () => {
    expect(extractDateRangeFromData({ plannedDate: ["2026-05-12"] }, "planned")).toEqual({
      endDate: "2026-05-12",
      startDate: "2026-05-12"
    });
    expect(extractDateRangeFromData({ actualDate: ["2026-05-12", "2026-05-20"] }, "actual")).toEqual({
      endDate: "2026-05-20",
      startDate: "2026-05-12"
    });
    expect(extractDateRangeFromData({
      plannedDate: ["Tue May 12 2026 09:00:00 GMT+0900 (日本標準時)"]
    }, "planned")).toEqual({
      endDate: "2026-05-12",
      startDate: "2026-05-12"
    });
  });

  it("不正日付、逆順日付、旧dateは読まず、有効な日付だけ書き戻し用に正規化する", () => {
    expect(extractDateRangeFromData({ plannedDate: ["2026-02-31"] }, "planned")).toBeNull();
    expect(extractDateRangeFromData({ plannedDate: ["2026-05-20", "2026-05-12"] }, "planned")).toBeNull();
    expect(extractDateRangeFromData({ date: ["2026-05-12"] }, "planned")).toBeNull();
    expect(normalizeDateFieldsForWrite({
      actualDate: ["2026-05-20", "2026-05-12"],
      custom: ["keep"],
      plannedDate: ["2026-05-12"]
    })).toEqual({
      actualDate: ["2026-05-20", "2026-05-12"],
      custom: ["keep"],
      plannedDate: ["2026-05-12"]
    });
  });
});
