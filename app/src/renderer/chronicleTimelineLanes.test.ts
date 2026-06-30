import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  assignChronicleLaneIndexes,
  chronicleLaneEntryKey,
  moveChronicleEntryLane,
  type ChronicleLaneEntry
} from "./chronicleTimeline";

function entry(path: string, startValue: number, endValue: number, chronicleEntryIndex = 0): ChartEntry {
  return {
    chronicleCalendarName: "",
    chronicleEntryIndex,
    endLabel: String(endValue),
    endPoint: { month: null, year: endValue },
    endValue,
    fileName: path,
    path,
    startLabel: String(startValue),
    startPoint: { month: null, year: startValue },
    startValue
  };
}

function laneEntry(item: ChartEntry, order: number): ChronicleLaneEntry {
  return {
    displayEntry: item,
    entry: item,
    key: chronicleLaneEntryKey(item),
    order
  };
}

describe("chronicleTimelineLanes", () => {
  it("重ならない期間は同じ段に配置する", () => {
    const entries = [
      laneEntry(entry("a.md", 1, 3), 0),
      laneEntry(entry("b.md", 4, 5), 1)
    ];

    expect(assignChronicleLaneIndexes(entries)).toEqual({
      "a.md:chronicle:0": 0,
      "b.md:chronicle:0": 0
    });
  });

  it("重なる期間は別段に配置する", () => {
    const entries = [
      laneEntry(entry("a.md", 1, 4), 0),
      laneEntry(entry("b.md", 3, 5), 1)
    ];

    expect(assignChronicleLaneIndexes(entries)).toEqual({
      "a.md:chronicle:0": 0,
      "b.md:chronicle:0": 1
    });
  });

  it("段移動で重なったバーを連鎖的に押しのける", () => {
    const entries = [
      laneEntry(entry("a.md", 1, 10), 0),
      laneEntry(entry("b.md", 1, 10), 1),
      laneEntry(entry("c.md", 1, 10), 2),
      laneEntry(entry("d.md", 11, 12), 3)
    ];
    const current = {
      "a.md:chronicle:0": 0,
      "b.md:chronicle:0": 1,
      "c.md:chronicle:0": 2,
      "d.md:chronicle:0": 0
    };

    expect(moveChronicleEntryLane(entries, current, "c.md:chronicle:0", 0)).toEqual({
      "a.md:chronicle:0": 1,
      "b.md:chronicle:0": 2,
      "c.md:chronicle:0": 0,
      "d.md:chronicle:0": 0
    });
  });
});
