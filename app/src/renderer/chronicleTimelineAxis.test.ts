import { describe, expect, it } from "vitest";

import {
  activeChronicleAxisCalendars,
  chronicleAxisHeightForCalendars,
  chronicleAxisTickInterval,
  chronicleUnitWidth,
  formatChronicleCalendarAxisLabel
} from "./chronicleTimelineAxis";

describe("chronicleTimelineAxis", () => {
  it("年表の unit と表示幅を計算する", () => {
    expect(chronicleAxisTickInterval(1)).toBe(1);
    expect(chronicleUnitWidth(1, 72)).toBe(6);
    expect(chronicleAxisHeightForCalendars([
      { name: "王国暦" },
      { name: "帝国暦", startYear: 100 }
    ])).toBe(34);
  });

  it("保存済みの暦設定があっても横軸は単一の年軸にする", () => {
    const calendars = activeChronicleAxisCalendars([
      { name: "王国暦" },
      { name: "帝国暦", startYear: 100 },
      { name: "未開始暦" }
    ]);

    expect(calendars.map((calendar) => calendar.name)).toEqual(["王国暦"]);
    expect(formatChronicleCalendarAxisLabel(calendars[0], 120)).toBe("120");
  });
});
