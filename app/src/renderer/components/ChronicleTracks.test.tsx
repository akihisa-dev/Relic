import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChartEntry } from "../../shared/ipc";
import { ChronicleTracks } from "./ChronicleTracks";

function entry(
  fileName: string,
  path: string,
  chronicleEntryIndex: number,
  startValue: number,
  endValue: number
): ChartEntry {
  return {
    chronicleCalendarName: "",
    chronicleEntryIndex,
    endLabel: String(endValue),
    endPoint: { month: null, year: endValue },
    endValue,
    fileName,
    path,
    startLabel: String(startValue),
    startPoint: { month: null, year: startValue },
    startValue
  };
}

describe("ChronicleTracks", () => {
  it("表示範囲外の通常項目をSVG要素として描画しない", () => {
    render(
      <ChronicleTracks
        activeSource="chronicle"
        axisStart={0}
        dragPreview={null}
        guideTicks={[]}
        laneLayoutResetKey="test"
        onOpenFile={vi.fn()}
        onStartEntryEdit={vi.fn()}
        rows={[
          { entries: [entry("Near", "near.md", 0, 4, 6)], fileName: "Near", key: "near", path: "near.md", statuses: [] },
          { entries: [entry("Far", "far.md", 0, 100, 101)], fileName: "Far", key: "far", path: "far.md", statuses: [] }
        ]}
        scrollLeft={0}
        timelineWidth={2000}
        trackViewportHeight={200}
        unitWidth={10}
        visibleRange={{ visibleEnd: 10, visibleStart: 0 }}
      />
    );

    expect(screen.getByRole("button", { name: /Near/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Far/ })).not.toBeInTheDocument();
  });
});
