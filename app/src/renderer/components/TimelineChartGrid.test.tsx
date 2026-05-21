import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TimelineChartEntry, CardbookTimelineChart } from "../../shared/ipc";
import {
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  timelineBounds
} from "../timelineTimeline";
import { I18nProvider } from "../i18n";
import { TimelineChartGrid, type TimelineChartGridProps } from "./TimelineChartGrid";

function entry(overrides: Partial<TimelineChartEntry> = {}): TimelineChartEntry {
  return {
    endLabel: "1333",
    endValue: 1332,
    cardName: "鎌倉時代",
    path: "history/kamakura.md",
    startLabel: "1185",
    startValue: 1184,
    ...overrides
  };
}

function chart(overrides: Partial<CardbookTimelineChart> = {}): CardbookTimelineChart {
  return {
    entries: [entry()],
    id: "timeline",
    name: "timeline",
    source: "timeline",
    ...overrides
  };
}

function renderGrid(overrides: Partial<TimelineChartGridProps> = {}) {
  const activeChart = overrides.activeChart === undefined ? chart() : overrides.activeChart;
  const activeSource = overrides.activeSource ?? activeChart?.source ?? "timeline";
  const entries = activeChart?.entries ?? [];
  const tickInterval = 1;
  const bounds = timelineBounds(entries, tickInterval);
  const ticks = buildTicks(bounds.axisStart, bounds.axisEnd, tickInterval);
  const props: TimelineChartGridProps = {
    activeChart,
    activeSource,
    axisHeight: 34,
    axisEnd: bounds.axisEnd,
    axisStart: bounds.axisStart,
    chartRef: createRef<HTMLDivElement>(),
    chartViewportWidth: 720,
    timelineOffscreenIndicators: { left: null, right: null },
    dragPreview: null,
    guideTicks: buildGuideTicks(bounds.axisStart, bounds.axisEnd, ticks, tickInterval),
    nameColumnWidth: 300,
    onChartPointerDown: vi.fn(),
    onChartScroll: vi.fn(),
    onJump: vi.fn(),
    onOpenCard: vi.fn(),
    onStartEntryEdit: vi.fn(),
    onVerticalJump: vi.fn(),
    onVerticalMinimapPointerDown: vi.fn(),
    rows: buildChartRows(entries, activeSource),
    scrollLeft: 0,
    tickInterval,
    timelineWidth: 720,
    unitWidth: 36,
    verticalMinimapRef: createRef<HTMLDivElement>(),
    verticalMinimapViewport: { heightPercent: 100, topPercent: 0 },
    verticalOffscreenIndicators: { bottom: null, top: null },
    ...overrides
  };

  return {
    props,
    ...render(
      <I18nProvider language="ja">
        <TimelineChartGrid {...props} />
      </I18nProvider>
    )
  };
}

describe("TimelineChartGrid", () => {
  it("timelineのname列、axis、barを既存class名で描画し操作callbackへつなぐ", () => {
    const { container, props } = renderGrid();

    expect(container.querySelector(".timeline-chart")).toBeInTheDocument();
    expect(container.querySelector(".timeline-name-column")).toHaveStyle({ width: "300px" });
    expect(container.querySelector(".timeline-name-header--timeline")).toBeInTheDocument();
    expect(container.querySelector(".timeline-axis--timeline")).toBeInTheDocument();
    expect(container.querySelector(".timeline-fill--timeline")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "鎌倉時代" }));
    fireEvent.click(screen.getByTitle("この年代へ移動"));
    fireEvent.pointerDown(container.querySelector(".timeline-chart") as Element);

    expect(props.onOpenCard).toHaveBeenCalledWith("history/kamakura.md");
    expect(props.onJump).toHaveBeenCalledWith(expect.any(Number));
    expect(props.onChartPointerDown).toHaveBeenCalledTimes(1);
  });

  it("timelineの長期間表示では画面外の年代DOMを描画しない", () => {
    const axisStart = -3000;
    const axisEnd = 3000;
    const timelineChart = chart({
      entries: [
        entry({
          endLabel: "1000",
          endValue: 999,
          cardName: "長期史",
          path: "history/long.md",
          startLabel: "-1000",
          startValue: -1000
        })
      ],
      id: "timeline",
      name: "timeline",
      source: "timeline"
    });
    const { container } = renderGrid({
      activeChart: timelineChart,
      activeSource: "timeline",
      axisEnd,
      axisStart,
      chartViewportWidth: 720,
      scrollLeft: 3000 * 36,
      timelineWidth: (axisEnd - axisStart + 1) * 36
    });
    const yearCells = container.querySelectorAll(".timeline-axis--timeline .timeline-axis-cell");
    const trackGuideLines = container.querySelectorAll(".timeline-tracks .timeline-guide-line");

    expect(yearCells.length).toBeLessThan(80);
    expect(trackGuideLines.length).toBeLessThan(80);
  });

  it("active chartなしでは既存empty表示を出す", () => {
    renderGrid({ activeChart: null, rows: [] });

    expect(screen.getByText("年表に表示できるカードはまだありません。")).toHaveClass("frontmatter-field-empty");
  });

  it("縦方向の画面外件数とミニマップを描画してcallbackへつなぐ", () => {
    const { container, props } = renderGrid({
      verticalMinimapViewport: { heightPercent: 24, topPercent: 36 },
      verticalOffscreenIndicators: {
        bottom: { count: 42, targetIndex: 20 },
        top: { count: 8, targetIndex: 0 }
      }
    });

    expect(container.querySelector(".timeline-chart-layout")).toBeInTheDocument();
    expect(container.querySelector(".timeline-vertical-panel")).toBeInTheDocument();
    expect(container.querySelector(".timeline-vertical-panel .timeline-vertical-minimap")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上に8件のカードがあります" }));
    fireEvent.click(screen.getByRole("button", { name: "下に42件のカードがあります" }));
    fireEvent.pointerDown(screen.getByRole("slider", { name: "縦方向ミニマップ" }));

    expect(props.onVerticalJump).toHaveBeenCalledWith(0);
    expect(props.onVerticalJump).toHaveBeenCalledWith(20);
    expect(props.onVerticalMinimapPointerDown).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".timeline-vertical-minimap-window")).toHaveStyle({
      height: "24%",
      top: "36%"
    });
  });
});
