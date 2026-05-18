import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GanttChartEntry, WorkspaceGanttChart } from "../../shared/ipc";
import {
  DATE_SCALES,
  buildChartRows,
  buildGuideTicks,
  buildTicks,
  timelineBounds
} from "../chronicleTimeline";
import { I18nProvider } from "../i18n";
import { ChronicleChartGrid, type ChronicleChartGridProps } from "./ChronicleChartGrid";

const day = (value: string): number =>
  Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);

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
  const dateScale = activeSource === "date" ? DATE_SCALES[0] : null;
  const tickInterval = 1;
  const bounds = timelineBounds(entries, tickInterval, activeSource, dateScale);
  const ticks = buildTicks(bounds.axisStart, bounds.axisEnd, tickInterval, activeSource, dateScale);
  const props: ChronicleChartGridProps = {
    activeChart,
    activeSource,
    axisEnd: bounds.axisEnd,
    axisStart: bounds.axisStart,
    chartRef: createRef<HTMLDivElement>(),
    chartViewportWidth: 720,
    chronicleOffscreenIndicators: { left: null, right: null },
    dateAxisHeight: activeSource === "date" ? 69 : 34,
    dateOffscreenIndicators: { left: null, right: null },
    dateScale,
    dragPreview: null,
    guideTicks: buildGuideTicks(bounds.axisStart, bounds.axisEnd, ticks, tickInterval, activeSource, dateScale),
    nameColumnWidth: activeSource === "date" ? 430 : 300,
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
    unitWidth: activeSource === "date" ? 22 : 36,
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

  it("dateのplanned/actual列とstatus badgeを既存class名で描画する", () => {
    const dateChart = chart({
      entries: [
        entry({
          dateKind: "planned",
          endLabel: "2026-05-05",
          endValue: day("2026-05-05"),
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-01",
          startValue: day("2026-05-01")
        }),
        entry({
          dateKind: "actual",
          endLabel: "2026-05-06",
          endValue: day("2026-05-06"),
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-03",
          startValue: day("2026-05-03"),
          statuses: ["完了"]
        })
      ],
      id: "date",
      name: "date",
      source: "date"
    });
    const { container } = renderGrid({ activeChart: dateChart, activeSource: "date" });

    expect(screen.getByText("計画")).toBeInTheDocument();
    expect(screen.getByText("実行")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-name-header--date")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-fill--planned")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-fill--actual")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-fill-status")).toHaveTextContent("完了");
  });

  it("dateの年・月ラベルを横スクロール位置へ追従させる", () => {
    const axisStart = day("2026-05-01");
    const dateChart = chart({
      entries: [
        entry({
          dateKind: "planned",
          endLabel: "2026-05-20",
          endValue: day("2026-05-20"),
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-01",
          startValue: axisStart
        })
      ],
      id: "date",
      name: "date",
      source: "date"
    });
    const { container } = renderGrid({
      activeChart: dateChart,
      activeSource: "date",
      axisEnd: day("2026-06-30"),
      axisStart,
      chartViewportWidth: 720,
      scrollLeft: 220,
      timelineWidth: 1342
    });
    const rows = container.querySelectorAll(".chronicle-axis--date .chronicle-axis-row");
    const yearLabel = rows[0]?.querySelector(".chronicle-axis-cell-label--follow") as HTMLElement;
    const monthLabel = rows[1]?.querySelector(".chronicle-axis-cell-label--follow") as HTMLElement;
    const dayLabel = rows[2]?.querySelector(".chronicle-axis-cell-label--follow");

    expect(yearLabel).toHaveTextContent("2026");
    expect(yearLabel).toHaveStyle({ transform: "translateX(226px)" });
    expect(monthLabel).toHaveTextContent("05");
    expect(monthLabel).toHaveStyle({ transform: "translateX(226px)" });
    expect(dayLabel).toBeNull();
  });

  it("dateの長期間表示では画面外の日単位DOMを描画しない", () => {
    const axisStart = day("2020-01-01");
    const axisEnd = day("2030-12-31");
    const dateChart = chart({
      entries: [
        entry({
          dateKind: "planned",
          endLabel: "2026-05-20",
          endValue: day("2026-05-20"),
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-01",
          startValue: day("2026-05-01")
        })
      ],
      id: "date",
      name: "date",
      source: "date"
    });
    const { container } = renderGrid({
      activeChart: dateChart,
      activeSource: "date",
      axisEnd,
      axisStart,
      chartViewportWidth: 720,
      scrollLeft: (day("2026-05-01") - axisStart) * 22,
      timelineWidth: (axisEnd - axisStart + 1) * 22
    });
    const dayCells = container.querySelectorAll(".chronicle-axis--date .chronicle-axis-row:nth-child(3) .chronicle-axis-cell");
    const trackGuideLines = container.querySelectorAll(".chronicle-tracks .chronicle-guide-line");

    expect(dayCells.length).toBeLessThan(80);
    expect(trackGuideLines.length).toBeLessThan(80);
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

    expect(screen.getByText("このガントチャートに表示できるファイルはまだありません。")).toHaveClass("frontmatter-field-empty");
  });

  it("縦方向の画面外件数とミニマップを描画してcallbackへつなぐ", () => {
    const { container, props } = renderGrid({
      verticalMinimapViewport: { heightPercent: 24, topPercent: 36 },
      verticalOffscreenIndicators: {
        bottom: { count: 42, targetIndex: 20 },
        top: { count: 8, targetIndex: 0 }
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "上に8件のファイルがあります" }));
    fireEvent.click(screen.getByRole("button", { name: "下に42件のファイルがあります" }));
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
