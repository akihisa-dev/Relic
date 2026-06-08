import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChartEntry, WorkspaceChart } from "../../shared/ipc";
import { defaultChronicleCalendars } from "../../shared/ipc";
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

function entry(overrides: Partial<ChartEntry> = {}): ChartEntry {
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

function chart(overrides: Partial<WorkspaceChart> = {}): WorkspaceChart {
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
    chronicleCalendars: defaultChronicleCalendars,
    dateAxisHeight: activeSource === "date" ? 69 : 34,
    dateOffscreenIndicators: { left: null, right: null },
    dateScale,
    dragPreview: null,
    guideTicks: buildGuideTicks(bounds.axisStart, bounds.axisEnd, ticks, tickInterval, activeSource, dateScale),
    nameColumnWidth: activeSource === "date" ? 430 : 0,
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
    expect(container.querySelector(".chronicle-chart-layout")).toHaveClass("chronicle-chart-layout--chronicle");
    expect(container.querySelector(".chronicle-vertical-panel")).toBeNull();
    expect(container.querySelector(".chronicle-vertical-minimap")).toBeNull();
    expect(container.querySelector(".chronicle-name-column")).toBeNull();
    expect(container.querySelector(".chronicle-name-header--chronicle")).toBeNull();
    expect(container.querySelector(".chronicle-year-summary")).toBeNull();
    expect(container.querySelector(".chronicle-axis--chronicle")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-fill--chronicle")).toBeInTheDocument();

    fireEvent.pointerDown(container.querySelector(".chronicle-chart") as Element);

    expect(props.onOpenFile).not.toHaveBeenCalled();
    expect(props.onJump).not.toHaveBeenCalled();
    expect(props.onChartPointerDown).toHaveBeenCalledTimes(1);
  });

  it("chronicleの横軸に設定済みのメイン暦とサブ暦を段で表示し、バーには暦名を出さない", () => {
    const { container } = renderGrid({
      activeChart: chart({
        entries: [
          entry({
            chronicleCalendarId: "chronicle1",
            chronicleCalendarName: "帝国暦",
            chronicleCalendarStartYear: 100,
            endLabel: "帝国暦 22",
            endValue: 120,
            startLabel: "帝国暦 21",
            startValue: 119
          })
        ]
      }),
      chronicleCalendars: [
        { id: "chronicle0", name: "王国暦" },
        { id: "chronicle1", name: "帝国暦", startYear: 100 }
      ],
      dateAxisHeight: 48,
      rows: buildChartRows([
        entry({
          chronicleCalendarId: "chronicle1",
          chronicleCalendarName: "帝国暦",
          chronicleCalendarStartYear: 100,
          endLabel: "帝国暦 22",
          endValue: 120,
          startLabel: "帝国暦 21",
          startValue: 119
        })
      ], "chronicle")
    });

    expect(container.querySelectorAll(".chronicle-axis--chronicle .chronicle-axis-row")).toHaveLength(2);
    expect(container.querySelector(".chronicle-name-header--chronicle")).toBeNull();
    expect(container.querySelector(".chronicle-year-summary")).toBeNull();
    expect(container.querySelector(".chronicle-fill-label")).toHaveTextContent("21 〜 22");
    expect(container.querySelector(".chronicle-fill-label")).not.toHaveTextContent("帝国暦");
  });

  it("chronicleでは重なるentryを別レーンに配置する", () => {
    const chronicleChart = chart({
      entries: [
        entry({ fileName: "A", path: "a.md", startValue: 10, endValue: 20 }),
        entry({ fileName: "B", path: "b.md", startValue: 12, endValue: 18 }),
        entry({ fileName: "C", path: "c.md", startValue: 30, endValue: 35 })
      ]
    });
    const { container } = renderGrid({
      activeChart: chronicleChart,
      rows: buildChartRows(chronicleChart.entries, "chronicle")
    });
    const fills = Array.from(container.querySelectorAll(".chronicle-fill--chronicle")) as SVGGElement[];
    const shapes = Array.from(container.querySelectorAll(".chronicle-fill-shape")) as SVGPathElement[];
    const hitPaths = Array.from(container.querySelectorAll(".chronicle-fill-hit")) as SVGPathElement[];

    expect(container.querySelector(".chronicle-name-column")).toBeNull();
    expect(container.querySelector(".chronicle-tracks")).toHaveStyle({ height: "76px" });
    expect(container.querySelector(".chronicle-tracks-svg")).toHaveAttribute("height", "76");
    expect(container.querySelectorAll(".chronicle-tracks .chronicle-guide-row-line")).toHaveLength(0);
    expect(fills).toHaveLength(3);
    expect(shapes).toHaveLength(3);
    expect(hitPaths).toHaveLength(3);
    expect(hitPaths.map((shape) => shape.getAttribute("d"))).toEqual([
      "M 111,0 H 501 Q 504,0 504,3 V 35 Q 504,38 501,38 H 111 Q 108,38 108,35 V 3 Q 108,0 111,0 Z",
      "M 183,38 H 429 Q 432,38 432,41 V 73 Q 432,76 429,76 H 183 Q 180,76 180,73 V 41 Q 180,38 183,38 Z",
      "M 831,0 H 1041 Q 1044,0 1044,3 V 35 Q 1044,38 1041,38 H 831 Q 828,38 828,35 V 3 Q 828,0 831,0 Z"
    ]);
    expect(container.querySelectorAll(".chronicle-fill-label")).toHaveLength(3);
    expect(shapes[0].getAttribute("d")).toContain("M 111,0");
    expect(fills[0].style.getPropertyValue("--chronicle-fill")).not.toBe(fills[1].style.getPropertyValue("--chronicle-fill"));
    expect(fills[2].style.getPropertyValue("--chronicle-fill")).toMatch(/^hsla\(/);
    expect(fills.map((fill) => fill.style.getPropertyValue("--chronicle-fill")).join(" ")).toMatch(/hsla\((126|168|202|226|252|286|322|354|18|42|82|190),/);
  });

  it("chronicleでは長いentryを分割せず1本のバーにする", () => {
    const chronicleChart = chart({
      entries: [
        entry({ fileName: "B", path: "b.md", startValue: 10, endValue: 12 }),
        entry({ endLabel: "30", fileName: "A", path: "a.md", startLabel: "10", startValue: 10, endValue: 30 }),
        entry({ fileName: "C", path: "c.md", startValue: 14, endValue: 16 })
      ]
    });
    const { container } = renderGrid({
      activeChart: chronicleChart,
      rows: buildChartRows(chronicleChart.entries, "chronicle")
    });
    const fills = Array.from(container.querySelectorAll(".chronicle-fill--chronicle")) as SVGGElement[];
    const longEntryBars = fills.filter((fill) => fill.getAttribute("aria-label")?.includes("A "));
    const longEntryHitPath = longEntryBars[0]?.querySelector(".chronicle-fill-hit") as SVGPathElement;

    expect(container.querySelector(".chronicle-tracks")).toHaveStyle({ height: "76px" });
    expect(container.querySelectorAll(".chronicle-tracks .chronicle-guide-row-line")).toHaveLength(0);
    expect(longEntryBars).toHaveLength(1);
    expect(longEntryHitPath.getAttribute("d")).toBe("M 111,38 H 861 Q 864,38 864,41 V 73 Q 864,76 861,76 H 111 Q 108,76 108,73 V 41 Q 108,38 111,38 Z");
    expect(longEntryBars[0]).toHaveTextContent("10 〜 30");
  });

  it("chronicleでは必要なレーン数に応じて年表の高さを広げる", () => {
    const chronicleChart = chart({
      entries: [
        entry({ fileName: "A", path: "a.md", startValue: 10, endValue: 20 }),
        entry({ fileName: "B", path: "b.md", startValue: 12, endValue: 18 }),
        entry({ fileName: "C", path: "c.md", startValue: 14, endValue: 16 })
      ]
    });
    const { container } = renderGrid({
      activeChart: chronicleChart,
      rows: buildChartRows(chronicleChart.entries, "chronicle")
    });
    const hitPaths = Array.from(container.querySelectorAll(".chronicle-fill-hit")) as SVGPathElement[];

    expect(container.querySelector(".chronicle-tracks")).toHaveStyle({ height: "114px" });
    expect(container.querySelector(".chronicle-tracks-svg")).toHaveAttribute("height", "114");
    expect(hitPaths.map((shape) => shape.getAttribute("d"))).toContain("M 219,76 H 321 Q 324,76 324,79 V 111 Q 324,114 321,114 H 219 Q 216,114 216,111 V 79 Q 216,76 219,76 Z");
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
    expect(container.querySelector(".chronicle-name-column")).toHaveStyle({ width: "430px" });
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

  it("dateでは縦方向の画面外件数とミニマップを描画してcallbackへつなぐ", () => {
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
        })
      ],
      id: "date",
      name: "date",
      source: "date"
    });
    const { container, props } = renderGrid({
      activeChart: dateChart,
      activeSource: "date",
      verticalMinimapViewport: { heightPercent: 24, topPercent: 36 },
      verticalOffscreenIndicators: {
        bottom: { count: 42, targetIndex: 20 },
        top: { count: 8, targetIndex: 0 }
      }
    });

    expect(container.querySelector(".chronicle-chart-layout")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-chart-layout")).not.toHaveClass("chronicle-chart-layout--chronicle");
    expect(container.querySelector(".chronicle-vertical-panel")).toBeInTheDocument();
    expect(container.querySelector(".chronicle-vertical-panel .chronicle-vertical-minimap")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上に8件のファイルがあります" }));
    fireEvent.click(screen.getByRole("button", { name: "下に42件のファイルがあります" }));
    fireEvent.pointerDown(screen.getByRole("scrollbar", { name: "縦方向ミニマップ" }));

    expect(props.onVerticalJump).toHaveBeenCalledWith(0);
    expect(props.onVerticalJump).toHaveBeenCalledWith(20);
    expect(props.onVerticalMinimapPointerDown).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".chronicle-vertical-minimap-window")).toHaveStyle({
      height: "24%",
      top: "36%"
    });
  });
});
