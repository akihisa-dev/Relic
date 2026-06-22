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
    expect(chronicleUnitWidth(1, 72)).toBe(36);
    expect(chronicleAxisHeightForCalendars([
      { id: "chronicle0", name: "王国暦" },
      { id: "chronicle1", name: "帝国暦", startYear: 100 }
    ])).toBe(48);
  });

  it("設定済み暦を横軸用に並べ、サブ暦の年をメイン暦から換算する", () => {
    const calendars = activeChronicleAxisCalendars([
      { id: "chronicle0", name: "王国暦" },
      { id: "chronicle1", name: "帝国暦", startYear: 100 },
      { id: "chronicle2", name: "未開始暦" }
    ]);

    expect(calendars.map((calendar) => calendar.name)).toEqual(["王国暦", "帝国暦"]);
    expect(formatChronicleCalendarAxisLabel(calendars[0], 120)).toBe("120");
    expect(formatChronicleCalendarAxisLabel(calendars[1], 120)).toBe("21");
  });
});
