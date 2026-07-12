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
        onOpenFile={vi.fn()}
        onStartEntryEdit={vi.fn()}
        rows={[
          { entries: [entry("Near", "near.md", 0, 4, 6)], fileName: "Near", key: "near", path: "near.md", statuses: [] },
          { entries: [entry("Far", "far.md", 0, 100, 101)], fileName: "Far", key: "far", path: "far.md", statuses: [] }
        ]}
        scrollLeft={0}
        timelineWidth={2000}
        timelineViewportWidth={300}
        trackViewportHeight={200}
        unitWidth={10}
        visibleRange={{ visibleEnd: 10, visibleStart: 0 }}
      />
    );

    expect(screen.getByRole("button", { name: /Near/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Far/ })).not.toBeInTheDocument();
  });

  it("短い項目を節点と読み取れるラベルで表示範囲内に描画する", () => {
    const { container } = render(
      <ChronicleTracks
        activeSource="chronicle"
        axisStart={0}
        dragPreview={null}
        guideTicks={[]}
        onOpenFile={vi.fn()}
        onStartEntryEdit={vi.fn()}
        rows={[
          { entries: [entry("Short", "short.md", 0, 9, 9)], fileName: "Short", key: "short", path: "short.md", statuses: [] }
        ]}
        scrollLeft={80}
        timelineWidth={400}
        timelineViewportWidth={120}
        trackViewportHeight={80}
        unitWidth={4}
        visibleRange={{ visibleEnd: 20, visibleStart: 0 }}
      />
    );

    const rangeLabel = container.querySelector(".chronicle-fill-range-label") as SVGTextElement;

    expect(container.querySelector(".chronicle-tracks")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-fill-shape")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-fill-node")).toHaveLength(1);
    expect(container.querySelector(".chronicle-fill-file-label")).toHaveTextContent("Short");
    expect(rangeLabel).toHaveTextContent("9");
    expect(Number(rangeLabel.getAttribute("x"))).toBeGreaterThanOrEqual(80);
    expect(Number(rangeLabel.getAttribute("x"))).toBeLessThanOrEqual(200);
  });

  it("期間を開始と終了の節点を結ぶ線として描画する", () => {
    const { container } = render(
      <ChronicleTracks
        activeSource="chronicle"
        axisStart={0}
        dragPreview={null}
        guideTicks={[]}
        onOpenFile={vi.fn()}
        onStartEntryEdit={vi.fn()}
        rows={[
          { entries: [entry("Range", "range.md", 0, 3, 8)], fileName: "Range", key: "range", path: "range.md", statuses: [] }
        ]}
        scrollLeft={0}
        timelineWidth={400}
        timelineViewportWidth={300}
        trackViewportHeight={100}
        unitWidth={10}
      />
    );

    expect(container.querySelectorAll(".chronicle-fill-node")).toHaveLength(2);
    expect(container.querySelector(".chronicle-fill-shape")).toHaveAttribute("x1", "30");
    expect(container.querySelector(".chronicle-fill-shape")).toHaveAttribute("x2", "80");
    expect(container.querySelector(".chronicle-fill-range-label")).toHaveTextContent("3 〜 8");
  });
});
