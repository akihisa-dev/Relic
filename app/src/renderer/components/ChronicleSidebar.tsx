import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { GanttChartEntry, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import { useT } from "../i18n";

interface ChronicleSidebarProps {
  activeChartId: string | null;
  charts: WorkspaceGanttChart[];
  onOpenChart: (chart: WorkspaceGanttChart) => void;
}

interface GanttChartViewProps {
  chart: WorkspaceGanttChart | null;
  onOpenFile: (path: string) => void;
  onRemoveFile: (chartId: string, path: string) => void;
}

type ChartFileTreeNode = ChartFileFolderNode | ChartFileNode;

interface ChartFileFolderNode {
  children: ChartFileTreeNode[];
  name: string;
  path: string;
  type: "folder";
}

interface ChartFileNode {
  entry: GanttChartEntry;
  name: string;
  path: string;
  type: "file";
}

const ROW_HEIGHT = 38;
const NAME_COLUMN_WIDTH = 180;
const TICK_WIDTH = 72;
const DATE_TICK_WIDTH = 52;
const LABEL_HORIZONTAL_PADDING = 14;
const SCALE_OPTIONS: Record<GanttChartSource, readonly number[]> = {
  chronicle: [25, 50, 100, 200, 500],
  date: [0, 1, 2]
};

const DATE_SCALES = [
  { label: "日", step: 1, unit: "day" },
  { label: "月", step: null, unit: "month" },
  { label: "年", step: null, unit: "year" }
] as const;

type DateScale = typeof DATE_SCALES[number];
type DateScaleUnit = DateScale["unit"];
type DateAxisSegmentUnit = DateScaleUnit | "month" | "year";

interface DateAxisSegment {
  endValue: number;
  label: string;
  startValue: number;
}

export function ChronicleSidebar({ activeChartId, charts, onOpenChart }: ChronicleSidebarProps): ReactElement {
  const selectedChart = charts.find((chart) => chart.id === activeChartId) ?? charts[0] ?? null;
  const candidateEntries = selectedChart ? entriesForSource(charts, selectedChart.source) : [];
  const candidateTree = useMemo(() => buildChartFileTree(candidateEntries), [candidateEntries]);
  const selectedChartFilePaths = useMemo(
    () => new Set(selectedChart?.filePaths ?? []),
    [selectedChart?.filePaths]
  );

  return (
    <div className="chronicle-sidebar">
      <div className="chronicle-source-buttons">
        {charts.map((chart) => (
          <button
            aria-pressed={chart.id === selectedChart?.id}
            className={`chronicle-source-button${chart.id === selectedChart?.id ? " active" : ""}`}
            key={chart.id}
            onClick={() => onOpenChart(chart)}
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
            ) : (
              <ChartFileTree
                chartId={selectedChart.id}
                nodes={candidateTree}
                selectedFilePaths={selectedChartFilePaths}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChartFileTree({
  chartId,
  nodes,
  selectedFilePaths
}: {
  chartId: string;
  nodes: ChartFileTreeNode[];
  selectedFilePaths: Set<string>;
}): ReactElement {
  return (
    <ul className="file-tree">
      {nodes.map((node) => (
        <ChartFileTreeItem
          chartId={chartId}
          key={node.path}
          node={node}
          selectedFilePaths={selectedFilePaths}
        />
      ))}
    </ul>
  );
}

function ChartFileTreeItem({
  chartId,
  node,
  selectedFilePaths
}: {
  chartId: string;
  node: ChartFileTreeNode;
  selectedFilePaths: Set<string>;
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  if (node.type === "folder") {
    return (
      <li className="file-tree-item">
        <div className="file-tree-row-wrap">
          <button
            className="file-tree-row folder"
            onClick={() => setIsExpanded((current) => !current)}
            title={node.path}
            type="button"
          >
            <span className={`file-tree-icon file-tree-icon--folder${isExpanded ? " file-tree-icon--expanded" : ""}`}>
              <span aria-hidden="true" className="file-tree-folder-chevron">▶</span>
              <span aria-hidden="true" className="file-tree-folder-icon" />
            </span>
            <span className="file-tree-name">{node.name}</span>
          </button>
        </div>
        {isExpanded ? (
          <ChartFileTree
            chartId={chartId}
            nodes={node.children}
            selectedFilePaths={selectedFilePaths}
          />
        ) : null}
      </li>
    );
  }

  const isSelected = selectedFilePaths.has(node.entry.path);

  return (
    <li className="file-tree-item">
      <div className="file-tree-row-wrap">
        <button
          className={`file-tree-row file${isSelected ? " selected" : ""}`}
          title={node.entry.path}
          type="button"
        >
          <span className="file-tree-icon">
            <span className="file-tree-file-dot">·</span>
          </span>
          <span className="file-tree-name">{node.name}</span>
        </button>
      </div>
    </li>
  );
}

export function GanttChartView({ chart, onOpenFile, onRemoveFile }: GanttChartViewProps): ReactElement {
  const t = useT();
  const [scaleIndex, setScaleIndex] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const activeSource = chart && isGanttChartSource(chart.source) ? chart.source : "chronicle";
  const scaleOptions = SCALE_OPTIONS[activeSource];
  const tickInterval = scaleOptions[Math.min(scaleIndex, scaleOptions.length - 1)] ?? scaleOptions[0] ?? 100;
  const dateScale = activeSource === "date" ? DATE_SCALES[tickInterval] ?? DATE_SCALES[2] : null;
  const entries = useMemo(() => visibleEntries(chart), [chart]);
  const { axisEnd, axisStart } = timelineBounds(entries, tickInterval, activeSource, dateScale);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const tickWidth = activeSource === "date" ? DATE_TICK_WIDTH : TICK_WIDTH;
  const unitWidth = activeSource === "date" ? dateUnitWidth(dateScale) : tickWidth / tickInterval;
  const timelineWidth = Math.max(720, axisSpan * unitWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval, activeSource, dateScale),
    [activeSource, axisEnd, axisStart, dateScale, tickInterval]
  );
  const gridOffset = ticks.length > 0 ? (ticks[0] - axisStart) * unitWidth : 0;
  const dateAxisHeight = activeSource === "date" ? dateAxisHeightForScale(dateScale) : 34;

  return (
    <div className="chronicle-panel">
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
          <span className="chronicle-scale-value">{formatScaleValue(tickInterval, activeSource)}</span>
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
      {!chart ? (
        <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>
      ) : (
        <div className="chronicle-chart" onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}>
          <div className="chronicle-grid" style={{ width: NAME_COLUMN_WIDTH + timelineWidth }}>
            <div className="chronicle-name-column" style={{ width: NAME_COLUMN_WIDTH }}>
              <div className="chronicle-name-header" style={{ height: dateAxisHeight }} />
              {entries.length === 0 ? (
                <div className="chronicle-file-name-row chronicle-file-name-row--empty">
                  <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    className="chronicle-file-name-row"
                    key={entry.path}
                  >
                    <button
                      className="chronicle-file-name"
                      onClick={() => onOpenFile(entry.path)}
                      title={entry.path}
                      type="button"
                    >
                      {entry.fileName}
                    </button>
                    <button
                      aria-label={`${entry.fileName}をチャートから外す`}
                      className="chronicle-file-remove"
                      onClick={() => chart ? onRemoveFile(chart.id, entry.path) : undefined}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="chronicle-timeline" style={{ marginLeft: NAME_COLUMN_WIDTH, width: timelineWidth }}>
              {activeSource === "date" ? (
                <DateAxis axisEnd={axisEnd} axisStart={axisStart} scale={dateScale ?? DATE_SCALES[2]} unitWidth={unitWidth} width={timelineWidth} />
              ) : (
                <div className="chronicle-axis" style={{ width: timelineWidth }}>
                  {ticks.map((tick, index) => (
                    <span
                      className={`chronicle-axis-tick${index === 0 ? " chronicle-axis-tick--start" : ""}${index === ticks.length - 1 ? " chronicle-axis-tick--end" : ""}`}
                      key={tick}
                      style={{ left: (tick - axisStart) * unitWidth }}
                    >
                      {formatAxisValue(tick, activeSource)}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`chronicle-tracks${activeSource === "date" ? " chronicle-tracks--date" : ""}`}
                style={{
                  "--chronicle-grid-x": `${tickInterval * unitWidth}px`,
                  "--chronicle-grid-offset-x": `${gridOffset}px`,
                  height: Math.max(1, entries.length) * ROW_HEIGHT,
                  width: timelineWidth
                } as CSSProperties}
              >
                {activeSource === "date" ? (
                  <DateGridLines axisStart={axisStart} ticks={ticks} unitWidth={unitWidth} />
                ) : null}
                {entries.map((entry, index) => {
                  const left = Math.max(0, (entry.startValue - axisStart) * unitWidth);
                  const isSingleValue = entry.startValue === entry.endValue;
                  const rangeLabel = formatRange(entry, activeSource, dateScale);
                  const labelWidth = labelWidthForText(rangeLabel);
                  const naturalWidth = isSingleValue ? unitWidth : (entry.endValue - entry.startValue + 1) * unitWidth;
                  const width = activeSource === "date"
                    ? naturalWidth
                    : isSingleValue
                      ? Math.max(46, naturalWidth)
                      : Math.max(28, naturalWidth);
                  const maxLabelLeft = Math.max(0, width - labelWidth);
                  const labelLeft = isSingleValue
                    ? (width - labelWidth) / 2
                    : Math.max(7, Math.min(maxLabelLeft, scrollLeft - left + 7));

                  return (
                    <button
                      className={`chronicle-fill${isSingleValue ? " chronicle-fill--single" : ""}`}
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

function DateAxis({
  axisEnd,
  axisStart,
  scale,
  unitWidth,
  width
}: {
  axisEnd: number;
  axisStart: number;
  scale: DateScale;
  unitWidth: number;
  width: number;
}): ReactElement {
  const years = buildDateAxisSegments(axisStart, axisEnd, "year");
  const months = buildDateAxisSegments(axisStart, axisEnd, "month");
  const units = buildDateAxisSegments(axisStart, axisEnd, scale.unit);
  const rows = scale.unit === "day"
    ? [years, months, units]
    : scale.unit === "year"
      ? [units]
      : [years, units];

  return (
    <div className="chronicle-axis chronicle-axis--date" style={{ width }}>
      {rows.map((row, rowIndex) => (
        <div
          className={`chronicle-axis-row${rowIndex < rows.length - 1 ? " chronicle-axis-row--divider" : ""}`}
          key={`date-axis-row-${rowIndex}`}
        >
          {row.map((segment) => (
            <span
              className="chronicle-axis-cell"
              key={`${rowIndex}-${segment.label}-${segment.startValue}`}
              style={{
                left: (segment.startValue - axisStart) * unitWidth,
                width: Math.max(1, (segment.endValue - segment.startValue + 1) * unitWidth)
              }}
            >
              {segment.label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function DateGridLines({
  axisStart,
  ticks,
  unitWidth
}: {
  axisStart: number;
  ticks: number[];
  unitWidth: number;
}): ReactElement {
  return (
    <>
      {ticks.map((tick) => (
        <span
          aria-hidden="true"
          className="chronicle-date-grid-line"
          key={tick}
          style={{ left: (tick - axisStart) * unitWidth }}
        />
      ))}
    </>
  );
}

function entriesForSource(charts: WorkspaceGanttChart[], source: GanttChartSource): GanttChartEntry[] {
  return charts.find((chart) => chart.source === source)?.entries ?? [];
}

function buildChartFileTree(entries: GanttChartEntry[]): ChartFileTreeNode[] {
  const root: ChartFileFolderNode = { children: [], name: "", path: "", type: "folder" };
  const foldersByPath = new Map<string, ChartFileFolderNode>([["", root]]);

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    let parent = root;
    let currentPath = "";

    for (const folderName of parts.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

      let folder = foldersByPath.get(currentPath);
      if (!folder) {
        folder = { children: [], name: folderName, path: currentPath, type: "folder" };
        foldersByPath.set(currentPath, folder);
        parent.children.push(folder);
      }

      parent = folder;
    }

    parent.children.push({
      entry,
      name: entry.fileName,
      path: entry.path,
      type: "file"
    });
  }

  sortChartFileTree(root.children);
  return root.children;
}

function sortChartFileTree(nodes: ChartFileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });

  for (const node of nodes) {
    if (node.type === "folder") sortChartFileTree(node.children);
  }
}

function visibleEntries(chart: WorkspaceGanttChart | null): GanttChartEntry[] {
  if (!chart) return [];
  if (!chart.filePaths || chart.filePaths.length === 0) return [];

  const entriesByPath = new Map(chart.entries.map((entry) => [entry.path, entry]));
  return chart.filePaths.flatMap((path) => {
    const entry = entriesByPath.get(path);
    return entry ? [entry] : [];
  });
}

function timelineBounds(
  entries: GanttChartEntry[],
  tickInterval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) {
    const today = source === "date" ? dateToDay(new Date().toISOString().slice(0, 10)) : 1;
    if (source === "date" && dateScale) {
      const start = previousDateUnit(today, dateScale.unit);
      let end = start;
      for (let i = 0; i < 8; i += 1) end = nextDateUnit(end, dateScale.unit);

      return { axisEnd: end - 1, axisStart: start };
    }

    return {
      axisEnd: today + tickInterval * 4,
      axisStart: today - tickInterval
    };
  }

  const starts = entries.map((entry) => entry.startValue);
  const ends = entries.map((entry) => entry.endValue);
  const min = Math.min(...starts);
  const max = Math.max(...ends);
  const padding = source === "date"
    ? Math.max(3, Math.ceil((max - min + 1) * 0.18))
    : Math.max(1, Math.ceil((max - min + 1) * 0.06));
  const paddedStart = min - padding;
  const paddedEnd = max + padding;

  if (source === "date" && dateScale) {
    return {
      axisEnd: nextDateUnit(paddedEnd, dateScale.unit) - 1,
      axisStart: previousDateUnit(paddedStart, dateScale.unit)
    };
  }

  return {
    axisEnd: Math.ceil(paddedEnd / tickInterval) * tickInterval + tickInterval,
    axisStart: Math.floor(paddedStart / tickInterval) * tickInterval - tickInterval
  };
}

function buildTicks(
  axisStart: number,
  axisEnd: number,
  interval: number,
  source: GanttChartSource,
  dateScale: DateScale | null
): number[] {
  if (source === "date") return buildDateTicks(axisStart, axisEnd, dateScale ?? DATE_SCALES[2]);

  const first = Math.floor(axisStart / interval) * interval;
  const ticks: number[] = [];

  for (let tick = first; tick <= axisEnd; tick += interval) {
    if (tick < axisStart) continue;
    ticks.push(tick);
  }

  return ticks;
}

function buildDateTicks(axisStart: number, axisEnd: number, scale: DateScale): number[] {
  const ticks: number[] = [];
  let cursor = previousDateUnit(axisStart, scale.unit);

  while (cursor <= axisEnd) {
    if (cursor >= axisStart) ticks.push(cursor);
    cursor = nextDateUnit(cursor, scale.unit);
  }

  return ticks;
}

function formatRange(entry: GanttChartEntry, source: GanttChartSource, dateScale: DateScale | null): string {
  if (source !== "date" || !dateScale) {
    if (entry.startValue === entry.endValue) return entry.startLabel;
    return `${entry.startLabel} 〜 ${entry.endLabel}`;
  }

  const start = formatDateLabel(entry.startLabel, dateScale.unit);
  const end = formatDateLabel(entry.endLabel, dateScale.unit);

  if (start === end) return start;
  return `${start} 〜 ${end}`;
}

function formatAxisValue(value: number, source: GanttChartSource): string {
  const year = value < 0 ? value : value + 1;
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

function formatScaleValue(value: number, source: GanttChartSource): string {
  if (source === "chronicle") return String(value);
  return DATE_SCALES[value]?.label ?? "月";
}

function labelWidthForText(text: string): number {
  return text.length * 8 + LABEL_HORIZONTAL_PADDING;
}

function dayToDate(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function dateToDay(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);
}

function buildDateAxisSegments(
  axisStart: number,
  axisEnd: number,
  unit: DateAxisSegmentUnit
): DateAxisSegment[] {
  const segments: DateAxisSegment[] = [];
  let cursor = startOfDateUnit(axisStart, unit);

  while (cursor <= axisEnd) {
    const next = nextDateUnit(cursor, unit);
    const startValue = Math.max(axisStart, cursor);
    const endValue = Math.min(axisEnd, next - 1);

    if (endValue >= startValue) {
      segments.push({
        endValue,
        label: formatDateAxisSegmentLabel(cursor, unit),
        startValue
      });
    }

    cursor = next;
  }

  return segments;
}

function startOfDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);
  if (unit === "day") return value;

  const month = unit === "year"
    ? 0
    : date.getUTCMonth();

  return dateToDay(`${date.getUTCFullYear()}-${String(month + 1).padStart(2, "0")}-01`);
}

function nextDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  const date = new Date(value * 86_400_000);

  if (unit === "day") return value + 1;

  if (unit === "month") {
    date.setUTCMonth(date.getUTCMonth() + 1, 1);
  } else {
    date.setUTCFullYear(date.getUTCFullYear() + 1, 0, 1);
  }

  return Math.floor(date.getTime() / 86_400_000);
}

function previousDateUnit(value: number, unit: DateAxisSegmentUnit): number {
  return startOfDateUnit(value, unit);
}

function dateUnitWidth(scale: DateScale | null): number {
  if (!scale) return DATE_TICK_WIDTH / 30;
  if (scale.unit === "day") return 22;
  if (scale.unit === "year") return 1.2;
  return (DATE_TICK_WIDTH * 3) / 30;
}

function dateAxisHeightForScale(scale: DateScale | null): number {
  return scale?.unit === "day" ? 69 : 46;
}

function formatDateAxisSegmentLabel(value: number, unit: DateAxisSegmentUnit): string {
  const date = new Date(value * 86_400_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (unit === "year") return String(year);
  if (unit === "day") return String(date.getUTCDate()).padStart(2, "0");
  return String(month).padStart(2, "0");
}

function formatDateLabel(value: string, unit: DateScaleUnit): string {
  if (unit === "day") return value.slice(8, 10);
  if (unit === "month") return value.slice(5);
  return value;
}

function isGanttChartSource(value: unknown): value is GanttChartSource {
  return value === "chronicle" || value === "date";
}
