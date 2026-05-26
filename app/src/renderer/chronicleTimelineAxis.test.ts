import { describe, expect, it } from "vitest";

import { dateToDay } from "../shared/chartTime";
import {
  activeChronicleAxisCalendars,
  buildDateAxisSegments,
  chronicleAxisHeightForCalendars,
  chronicleAxisTickInterval,
  chronicleUnitWidth,
  dateAxisFollowLabelOffset,
  dateAxisHeightForScale,
  dateGuideUnit,
  dateMajorGuideUnit,
  dateUnitWidth,
  formatDateAxisSegmentLabel,
  formatDateLabel,
  formatChronicleCalendarAxisLabel,
  nextDateUnit,
  startOfDateUnit
} from "./chronicleTimelineAxis";
import { DATE_SCALES } from "./chronicleTimelineConstants";

describe("chronicleTimelineAxis", () => {
  it("固定単位の unit と表示幅を計算する", () => {
    expect(chronicleAxisTickInterval(1)).toBe(1);
    expect(dateGuideUnit(DATE_SCALES[0])).toBe("day");
    expect(dateMajorGuideUnit(DATE_SCALES[0])).toBe("month");
    expect(dateUnitWidth(DATE_SCALES[0])).toBe(22);
    expect(dateAxisHeightForScale(DATE_SCALES[0])).toBe(69);
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

  it("date unit の境界と axis segment label を維持する", () => {
    const may15 = dateToDay("2026-05-15");

    expect(startOfDateUnit(may15, "month")).toBe(dateToDay("2026-05-01"));
    expect(startOfDateUnit(may15, "year")).toBe(dateToDay("2026-01-01"));
    expect(nextDateUnit(dateToDay("2026-12-01"), "month")).toBe(dateToDay("2027-01-01"));
    expect(formatDateAxisSegmentLabel(may15, "day")).toBe("15");
    expect(formatDateAxisSegmentLabel(may15, "month")).toBe("05");
    expect(formatDateAxisSegmentLabel(may15, "year")).toBe("2026");
    expect(formatDateLabel("2026-05-15", "day")).toBe("15");

    expect(buildDateAxisSegments(may15, dateToDay("2026-06-02"), "month")).toEqual([
      { endValue: dateToDay("2026-05-31"), label: "05", startValue: may15 },
      { endValue: dateToDay("2026-06-02"), label: "06", startValue: dateToDay("2026-06-01") }
    ]);

    expect(dateAxisFollowLabelOffset({
      axisStart: dateToDay("2026-05-01"),
      scrollLeft: 220,
      segment: { endValue: dateToDay("2026-05-31"), label: "05", startValue: dateToDay("2026-05-01") },
      unitWidth: 22
    })).toBe(226);
    expect(dateAxisFollowLabelOffset({
      axisStart: dateToDay("2026-05-01"),
      scrollLeft: 900,
      segment: { endValue: dateToDay("2026-05-31"), label: "05", startValue: dateToDay("2026-05-01") },
      unitWidth: 22
    })).toBe(652);
  });
});
