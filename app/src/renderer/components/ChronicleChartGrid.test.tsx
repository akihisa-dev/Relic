import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GanttChartEntry, WorkspaceGanttChart } from "../../shared/ipc";
import {
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  timelineBounds
} from "../chronicleTimeline";
import { I18nProvider } from "../i18n";
import { ChronicleChartGrid, type ChronicleChartGridProps } from "./ChronicleChartGrid";

function entry(overrides: Partial<GanttChartEntry> = {}): GanttChartEntry {
  return {
    endLabel: "1333",
    endValue: 1332,
    fileName: "鎌倉時代",
    path: "history/kamakura.md",
    startLabel: "1185",
    startValue: 1184,
    ...overrides
  };
}

function chart(overrides: Partial<WorkspaceGanttChart> = {}): WorkspaceGanttChart {
  return {
    entries: [entry()],
    id: "chronicle",
    name: "chronicle",
    source: "chronicle",
    ...overrides
  };
}

function renderGrid(overrides: Partial<ChronicleChartGridProps> = {}) {
  const activeChart = overrides.activeChart === undefined ? chart() : overrides.activeChart;
  const activeSource = overrides.activeSource ?? activeChart?.source ?? "chronicle";
  const entries = activeChart?.entries ?? [];
  const tickInterval = 1;
  const bounds = timelineBounds(entries, tickInterval);
  const ticks = buildTicks(bounds.axisStart, bounds.axisEnd, tickInterval);
  const props: ChronicleChartGridProps = {
    activeChart,
    activeSource,
    axisHeight: 34,
    axisEnd: bounds.axisEnd,
    axisStart: bounds.axisStart,
    chartRef: createRef<HTMLDivElement>(),
    chartViewportWidth: 720,
    chronicleOffscreenIndicators: { left: null, right: null },
    dragPreview: null,
    guideTicks: buildGuideTicks(bounds.axisStart, bounds.axisEnd, ticks, tickInterval),
    nameColumnWidth: 300,
    onChartPointerDown: vi.fn(),
    onChartScroll: vi.fn(),
    onJump: vi.fn(),
    onOpenFile: vi.fn(),
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
        <ChronicleChartGrid {...props} />
      </I18nProvider>
    )
  };
}

describe("ChronicleChartGrid", () => {
  it("chronicleのname列、axis、barを既存class名で描画し操作callbackへつなぐ", () => {
    const { container, props } = renderGrid();

    expect(container.querySelector(".chronicle-chart")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-name-column")).toHaveStyle({ width: "300px" });
    expect(container.querySelector(".chronicle-name-header--chronicle")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-axis--chronicle")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-fill--chronicle")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "鎌倉時代" }));
    fireEvent.click(screen.getByTitle("この年代へ移動"));
    fireEvent.pointerDown(container.querySelector(".chronicle-chart") as Element);

    expect(props.onOpenFile).toHaveBeenCalledWith("history/kamakura.md");
    expect(props.onJump).toHaveBeenCalledWith(expect.any(Number));
    expect(props.onChartPointerDown).toHaveBeenCalledTimes(1);
  });

  it("chronicleの長期間表示では画面外の年代DOMを描画しない", () => {
    const axisStart = -3000;
    const axisEnd = 3000;
    const chronicleChart = chart({
      entries: [
        entry({
          endLabel: "1000",
          endValue: 999,
          fileName: "長期史",
          path: "history/long.md",
          startLabel: "-1000",
          startValue: -1000
        })
      ],
      id: "chronicle",
      name: "chronicle",
      source: "chronicle"
    });
    const { container } = renderGrid({
      activeChart: chronicleChart,
      activeSource: "chronicle",
      axisEnd,
      axisStart,
      chartViewportWidth: 720,
      scrollLeft: 3000 * 36,
      timelineWidth: (axisEnd - axisStart + 1) * 36
    });
    const yearCells = container.querySelectorAll(".chronicle-axis--chronicle .chronicle-axis-cell");
    const trackGuideLines = container.querySelectorAll(".chronicle-tracks .chronicle-guide-line");

    expect(yearCells.length).toBeLessThan(80);
    expect(trackGuideLines.length).toBeLessThan(80);
  });

  it("active chartなしでは既存empty表示を出す", () => {
    renderGrid({ activeChart: null, rows: [] });

    expect(screen.getByText("Chronicleに表示できるカードはまだありません。")).toHaveClass("frontmatter-field-empty");
  });

  it("縦方向の画面外件数とミニマップを描画してcallbackへつなぐ", () => {
    const { container, props } = renderGrid({
      verticalMinimapViewport: { heightPercent: 24, topPercent: 36 },
      verticalOffscreenIndicators: {
        bottom: { count: 42, targetIndex: 20 },
        top: { count: 8, targetIndex: 0 }
      }
    });

    expect(container.querySelector(".chronicle-chart-layout")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-vertical-panel")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-vertical-panel .chronicle-vertical-minimap")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上に8件のカードがあります" }));
    fireEvent.click(screen.getByRole("button", { name: "下に42件のカードがあります" }));
    fireEvent.pointerDown(screen.getByRole("slider", { name: "縦方向ミニマップ" }));

    expect(props.onVerticalJump).toHaveBeenCalledWith(0);
    expect(props.onVerticalJump).toHaveBeenCalledWith(20);
    expect(props.onVerticalMinimapPointerDown).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".chronicle-vertical-minimap-window")).toHaveStyle({
      height: "24%",
      top: "36%"
    });
  });
});
