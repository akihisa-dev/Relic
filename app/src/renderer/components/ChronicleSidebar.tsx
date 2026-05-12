import { useMemo, useState } from "react";
import type { CSSProperties, DragEvent, ReactElement } from "react";

import type { GanttChartEntry, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import { useT } from "../i18n";

interface ChronicleSidebarProps {
  activeChartId: string | null;
  charts: WorkspaceGanttChart[];
  onOpenChart: (chart: WorkspaceGanttChart) => void;
}

interface GanttChartViewProps {
  chart: WorkspaceGanttChart | null;
  onAddFile: (chartId: string, path: string) => void;
  onOpenFile: (path: string) => void;
  onRemoveFile: (chartId: string, path: string) => void;
}

const ROW_HEIGHT = 38;
const NAME_COLUMN_WIDTH = 180;
const TICK_WIDTH = 72;
const LABEL_HORIZONTAL_PADDING = 14;
const SCALE_OPTIONS: Record<GanttChartSource, readonly number[]> = {
  chronicle: [25, 50, 100, 200, 500],
  date: [7, 30, 90, 365]
};

export function ChronicleSidebar({ activeChartId, charts, onOpenChart }: ChronicleSidebarProps): ReactElement {
  const selectedChart = charts.find((chart) => chart.id === activeChartId) ?? charts[0] ?? null;
  const candidateEntries = selectedChart ? entriesForSource(charts, selectedChart.source) : [];

  return (
    <div className="chronicle-sidebar">
      <div className="chronicle-source-toggle" role="tablist">
        {charts.map((chart) => (
          <button
            aria-selected={chart.id === selectedChart?.id}
            className={`chronicle-source-toggle-button${chart.id === selectedChart?.id ? " active" : ""}`}
            key={chart.id}
            onClick={() => onOpenChart(chart)}
            role="tab"
            type="button"
          >
            {chart.source}
          </button>
        ))}
      </div>

      {selectedChart ? (
        <div className="chronicle-sidebar-detail">
          <div className="chronicle-file-select">
            {candidateEntries.length === 0 ? (
              <div className="frontmatter-field-empty">表示できるファイルはまだありません。</div>
            ) : candidateEntries.map((entry) => (
                <div
                  className="chronicle-file-option"
                  draggable
                  key={entry.path}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/relic-gantt-file", JSON.stringify({
                      chartId: selectedChart.id,
                      path: entry.path
                    }));
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  title={entry.path}
                >
                  <span>{entry.fileName}</span>
                </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GanttChartView({ chart, onAddFile, onOpenFile, onRemoveFile }: GanttChartViewProps): ReactElement {
  const t = useT();
  const [scaleIndex, setScaleIndex] = useState(2);
  const [scrollLeft, setScrollLeft] = useState(0);
  const activeSource = chart && isGanttChartSource(chart.source) ? chart.source : "chronicle";
  const scaleOptions = SCALE_OPTIONS[activeSource];
  const tickInterval = scaleOptions[Math.min(scaleIndex, scaleOptions.length - 1)] ?? scaleOptions[0] ?? 100;
  const yearWidth = TICK_WIDTH / tickInterval;
  const entries = useMemo(() => visibleEntries(chart), [chart]);
  const { axisEnd, axisStart } = timelineBounds(entries, tickInterval);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const timelineWidth = Math.max(720, axisSpan * yearWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval),
    [axisEnd, axisStart, tickInterval]
  );
  const gridOffset = ticks.length > 0 ? (ticks[0] - axisStart) * yearWidth : 0;

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    if (!chart) return;

    const raw = event.dataTransfer.getData("application/relic-gantt-file");
    if (!raw) return;

    event.preventDefault();

    try {
      const payload = JSON.parse(raw) as { chartId?: string; path?: string };
      if (payload.chartId === chart.id && payload.path) onAddFile(chart.id, payload.path);
    } catch {
      return;
    }
  };

  return (
    <div
      className="chronicle-panel"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("application/relic-gantt-file")) event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      <div className="chronicle-panel-header">
        <div className="links-panel-subheading">{chart?.name ?? t("chronicle.title")}</div>
        <div className="chronicle-scale" aria-label={t("chronicle.scale")}>
          <button
            aria-label={t("chronicle.scaleDecrease")}
            className="chronicle-scale-button"
            disabled={scaleIndex === 0}
            onClick={() => setScaleIndex((current) => Math.max(0, current - 1))}
            type="button"
          >
            -
          </button>
          <span className="chronicle-scale-value">{tickInterval}</span>
          <button
            aria-label={t("chronicle.scaleIncrease")}
            className="chronicle-scale-button"
            disabled={scaleIndex >= scaleOptions.length - 1}
            onClick={() => setScaleIndex((current) => Math.min(scaleOptions.length - 1, current + 1))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      {!chart || entries.length === 0 ? (
        <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>
      ) : (
        <div className="chronicle-chart" onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}>
          <div className="chronicle-grid" style={{ width: NAME_COLUMN_WIDTH + timelineWidth }}>
            <div className="chronicle-name-column" style={{ width: NAME_COLUMN_WIDTH }}>
              <div className="chronicle-name-header" />
              {entries.map((entry) => (
                <div className="chronicle-file-name-row" key={entry.path}>
                  <button
                    className="chronicle-file-name"
                    onClick={() => onOpenFile(entry.path)}
                    title={entry.path}
                    type="button"
                  >
                    {entry.fileName}
                  </button>
                  <button
                    aria-label={`${entry.fileName}を年表から外す`}
                    className="chronicle-file-remove"
                    onClick={() => chart ? onRemoveFile(chart.id, entry.path) : undefined}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="chronicle-timeline" style={{ marginLeft: NAME_COLUMN_WIDTH, width: timelineWidth }}>
              <div className="chronicle-axis" style={{ width: timelineWidth }}>
                {ticks.map((tick, index) => (
                  <span
                    className={`chronicle-axis-tick${index === 0 ? " chronicle-axis-tick--start" : ""}${index === ticks.length - 1 ? " chronicle-axis-tick--end" : ""}`}
                    key={tick}
                    style={{ left: (tick - axisStart) * yearWidth }}
                  >
                    {formatAxisValue(tick, activeSource)}
                  </span>
                ))}
              </div>
              <div
                className="chronicle-tracks"
                style={{
                  "--chronicle-grid-x": `${tickInterval * yearWidth}px`,
                  "--chronicle-grid-offset-x": `${gridOffset}px`,
                  height: entries.length * ROW_HEIGHT,
                  width: timelineWidth
                } as CSSProperties}
              >
                {entries.map((entry, index) => {
                  const left = Math.max(0, (entry.startValue - axisStart) * yearWidth);
                  const isSingleYear = entry.startValue === entry.endValue;
                  const rangeLabel = formatRange(entry);
                  const labelWidth = labelWidthForText(rangeLabel);
                  const naturalWidth = isSingleYear ? yearWidth : (entry.endValue - entry.startValue + 1) * yearWidth;
                  const width = isSingleYear ? Math.max(46, naturalWidth) : Math.max(28, naturalWidth);
                  const maxLabelLeft = Math.max(0, width - labelWidth);
                  const labelLeft = isSingleYear
                    ? (width - labelWidth) / 2
                    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));

                  return (
                    <button
                      className={`chronicle-fill${isSingleYear ? " chronicle-fill--single" : ""}`}
                      key={entry.path}
                      onClick={() => onOpenFile(entry.path)}
                      style={{
                        left,
                        top: index * ROW_HEIGHT,
                        width
                      }}
                      title={`${entry.fileName} ${rangeLabel}`}
                      type="button"
                    >
                      <span className="chronicle-fill-label" style={{ left: labelLeft, width: labelWidth }}>{rangeLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function entriesForSource(charts: WorkspaceGanttChart[], source: GanttChartSource): GanttChartEntry[] {
  return charts.find((chart) => chart.source === source)?.entries ?? [];
}

function visibleEntries(chart: WorkspaceGanttChart | null): GanttChartEntry[] {
  if (!chart) return [];
  if (!chart.filePaths) return chart.entries;

  const visiblePaths = new Set(chart.filePaths);
  return chart.entries.filter((entry) => visiblePaths.has(entry.path));
}

function timelineBounds(entries: GanttChartEntry[], tickInterval: number): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) return { axisEnd: 1, axisStart: 1 };

  const starts = entries.map((entry) => entry.startValue);
  const ends = entries.map((entry) => entry.endValue);
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const padding = Math.max(1, Math.ceil((max - min + 1) * 0.06));
  const paddedStart = min - padding;
  const paddedEnd = max + padding;

  return {
    axisEnd: Math.ceil(paddedEnd / tickInterval) * tickInterval + tickInterval,
    axisStart: Math.floor(paddedStart / tickInterval) * tickInterval - tickInterval
  };
}

function buildTicks(axisStart: number, axisEnd: number, interval: number): number[] {
  const first = Math.floor(axisStart / interval) * interval;
  const ticks: number[] = [];

  for (let tick = first; tick <= axisEnd; tick += interval) {
    if (tick < axisStart) continue;
    ticks.push(tick);
  }

  return ticks;
}

function formatRange(entry: GanttChartEntry): string {
  if (entry.startValue === entry.endValue) return entry.startLabel;
  return `${entry.startLabel} 〜 ${entry.endLabel}`;
}

function formatAxisValue(value: number, source: GanttChartSource): string {
  if (source === "date") return dayToDate(value);

  const year = value < 0 ? value : value + 1;
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

function dayToDate(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle" || value === "date";
}
