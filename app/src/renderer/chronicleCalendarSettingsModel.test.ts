import { describe, expect, it } from "vitest";

import {
  createChronicleCalendarSettingsDraft,
  normalizeChronicleCalendarSettingsDraft,
  parseChronicleCalendarEndYear,
  parseChronicleCalendarYearOne
} from "./chronicleCalendarSettingsModel";

describe("chronicleCalendarSettingsModel", () => {
  it("保存済みの整数年を編集中の文字列へ変換する", () => {
    expect(createChronicleCalendarSettingsDraft({
      baseCalendarName: "基準暦",
      calendars: [{ name: "別暦", range: { end: 80, start: -10 }, yearOne: -240 }],
      visibleCalendarNames: ["基準暦"]
    })).toEqual({
      baseCalendarName: "基準暦",
      calendars: [{ isNew: false, name: "別暦", rangeEnd: "80", yearOne: "-240" }],
      visibleCalendarNames: ["基準暦"]
    });
  });

  it("暦名と開始位置を正規化し、暦面を1年から開始する", () => {
    expect(normalizeChronicleCalendarSettingsDraft({
      baseCalendarName: " 基準暦 ",
      calendars: [{ isNew: false, name: " 別暦 ", rangeEnd: "80", yearOne: " -240 " }],
      visibleCalendarNames: ["基準暦", "存在しない暦"]
    })).toEqual({
      baseCalendarName: "基準暦",
      calendars: [{ name: "別暦", range: { end: 80, start: 1 }, yearOne: -240 }],
      visibleCalendarNames: ["基準暦"]
    });
  });

  it("表示暦が残らない場合は基準暦を表示する", () => {
    expect(normalizeChronicleCalendarSettingsDraft({
      baseCalendarName: "基準暦",
      calendars: [],
      visibleCalendarNames: []
    })?.visibleCalendarNames).toEqual(["基準暦"]);
  });

  it("空の暦名、重複名、不正な開始年を保存対象にしない", () => {
    expect(normalizeChronicleCalendarSettingsDraft({
      baseCalendarName: "基準暦",
      calendars: [{ isNew: false, name: "", rangeEnd: "", yearOne: "1" }],
      visibleCalendarNames: ["基準暦"]
    })).toBeNull();
    expect(normalizeChronicleCalendarSettingsDraft({
      baseCalendarName: "基準暦",
      calendars: [{ isNew: false, name: "基準暦", rangeEnd: "", yearOne: "1" }],
      visibleCalendarNames: ["基準暦"]
    })).toBeNull();
    expect(parseChronicleCalendarYearOne("0")).toBeNull();
    expect(parseChronicleCalendarYearOne("1.5")).toBeNull();
    expect(parseChronicleCalendarYearOne("-")).toBeNull();
  });

  it("新しい暦は1以上の終了年が入力されるまで保存しない", () => {
    expect(normalizeChronicleCalendarSettingsDraft({
      baseCalendarName: "基準暦",
      calendars: [{ isNew: true, name: "別暦", rangeEnd: "", yearOne: "1" }],
      visibleCalendarNames: ["基準暦", "別暦"]
    })).toBeNull();
    expect(parseChronicleCalendarEndYear("1")).toEqual({ end: 1, start: 1 });
    expect(parseChronicleCalendarEndYear("0")).toBeNull();
    expect(parseChronicleCalendarEndYear("-1")).toBeNull();
  });
});
