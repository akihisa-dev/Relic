import { describe, expect, it } from "vitest";

import { baseYearToCalendarYear, calendarYearToBaseYear } from "./chronicleCalendar";

const settings = {
  baseCalendarName: "基準暦",
  calendars: [{ name: "別暦", yearOne: 450 }],
  visibleCalendarNames: ["基準暦", "別暦"]
};

describe("chronicleCalendar", () => {
  it("年0を作らずに基準暦と別暦を往復する", () => {
    expect(calendarYearToBaseYear(-2, "別暦", settings)).toBe(448);
    expect(calendarYearToBaseYear(-1, "別暦", settings)).toBe(449);
    expect(calendarYearToBaseYear(1, "別暦", settings)).toBe(450);
    expect(calendarYearToBaseYear(2, "別暦", settings)).toBe(451);
    expect(baseYearToCalendarYear(448, "別暦", settings)).toBe(-2);
    expect(baseYearToCalendarYear(449, "別暦", settings)).toBe(-1);
    expect(baseYearToCalendarYear(450, "別暦", settings)).toBe(1);
    expect(baseYearToCalendarYear(451, "別暦", settings)).toBe(2);
  });

  it("未設定の暦は換算しない", () => {
    expect(calendarYearToBaseYear(1, "不明", settings)).toBeNull();
  });
});
