import { describe, expect, it } from "vitest";

import { dateToDay } from "../shared/chartTime";
import {
  buildDateAxisSegments,
  chronicleAxisTickInterval,
  chronicleUnitWidth,
  dateAxisHeightForScale,
  dateGuideUnit,
  dateMajorGuideUnit,
  dateUnitWidth,
  formatDateAxisSegmentLabel,
  formatDateLabel,
  nextDateUnit,
  startOfDateUnit
} from "./chronicleTimelineAxis";
import { DATE_SCALES } from "./chronicleTimelineConstants";

describe("chronicleTimelineAxis", () => {
  it("固定単位の unit と表示幅を計算する", () => {
    expect(chronicleAxisTickInterval(1)).toBe(1);
    expect(dateGuideUnit(DATE_SCALES[2])).toBe("month");
    expect(dateMajorGuideUnit(DATE_SCALES[2])).toBe("year");
    expect(dateUnitWidth(DATE_SCALES[0])).toBe(22);
    expect(dateUnitWidth(DATE_SCALES[2])).toBe(1.2);
    expect(dateAxisHeightForScale(DATE_SCALES[0])).toBe(69);
    expect(chronicleUnitWidth(1, 72)).toBe(36);
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
    expect(formatDateLabel("2026-05-15", "month")).toBe("05-15");

    expect(buildDateAxisSegments(may15, dateToDay("2026-06-02"), "month")).toEqual([
      { endValue: dateToDay("2026-05-31"), label: "05", startValue: may15 },
      { endValue: dateToDay("2026-06-02"), label: "06", startValue: dateToDay("2026-06-01") }
    ]);
  });
});
