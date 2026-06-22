import { describe, expect, it } from "vitest";

import {
  calendarMainStartYear,
  calendarYearToMainYear,
  extractFirstChronicleRangeFromData,
  formatCalendarYear,
  mainYearToCalendarYear
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
});
