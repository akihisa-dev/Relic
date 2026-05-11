import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ChronicleEntry } from "../../shared/ipc";
import { useT } from "../i18n";

interface ChronicleSidebarProps {
  entries: ChronicleEntry[];
  onOpenFile: (path: string) => void;
}

const ROW_HEIGHT = 38;
const NAME_COLUMN_WIDTH = 180;
const SCALE_OPTIONS = [25, 50, 100, 200, 500] as const;
const TICK_WIDTH = 144;

export function ChronicleSidebar({ entries, onOpenFile }: ChronicleSidebarProps): ReactElement {
  const t = useT();
  const [scaleIndex, setScaleIndex] = useState(2);
  const tickInterval = SCALE_OPTIONS[scaleIndex] ?? 100;
  const yearWidth = TICK_WIDTH / tickInterval;
  const { axisEnd, axisStart } = timelineBounds(entries, tickInterval);
  const axisSpan = Math.max(1, axisEnd - axisStart + 1);
  const timelineWidth = Math.max(720, axisSpan * yearWidth);
  const ticks = useMemo(
    () => buildTicks(axisStart, axisEnd, tickInterval),
    [axisEnd, axisStart, tickInterval]
  );
  const gridOffset = ticks.length > 0 ? (ticks[0] - axisStart) * yearWidth : 0;

  return (
    <div className="chronicle-panel">
      <div className="chronicle-panel-header">
        <div className="links-panel-subheading">{t("chronicle.title")}</div>
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
            disabled={scaleIndex === SCALE_OPTIONS.length - 1}
            onClick={() => setScaleIndex((current) => Math.min(SCALE_OPTIONS.length - 1, current + 1))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>
      ) : (
        <div className="chronicle-chart">
          <div className="chronicle-grid" style={{ width: NAME_COLUMN_WIDTH + timelineWidth }}>
            <div className="chronicle-name-column" style={{ width: NAME_COLUMN_WIDTH }}>
              <div className="chronicle-name-header" />
              {entries.map((entry) => (
                <button
                  className="chronicle-file-name"
                  key={entry.path}
                  onClick={() => onOpenFile(entry.path)}
                  title={entry.path}
                  type="button"
                >
                  {entry.fileName}
                </button>
              ))}
            </div>
            <div className="chronicle-timeline" style={{ marginLeft: NAME_COLUMN_WIDTH, width: timelineWidth }}>
              <div className="chronicle-axis" style={{ width: timelineWidth }}>
                {ticks.map((tick) => (
                  <span
                    className="chronicle-axis-tick"
                    key={tick}
                    style={{ left: (tick - axisStart) * yearWidth }}
                  >
                    {formatAxisYear(tick)}
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
                  const start = yearToAxis(entry.startYear);
                  const end = yearToAxis(entry.endYear);
                  const left = Math.max(0, (start - axisStart) * yearWidth);
                  const isSingleYear = entry.startYear === entry.endYear;
                  const width = isSingleYear ? Math.max(46, yearWidth) : Math.max(28, (end - start + 1) * yearWidth);
                  const rangeLabel = formatRange(entry);

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
                      {rangeLabel}
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

function timelineBounds(entries: ChronicleEntry[], tickInterval: number): { axisEnd: number; axisStart: number } {
  if (entries.length === 0) return { axisEnd: 1, axisStart: 1 };

  const starts = entries.map((entry) => yearToAxis(entry.startYear));
  const ends = entries.map((entry) => yearToAxis(entry.endYear));
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

function yearToAxis(year: number): number {
  if (year === 0) return 0;
  return year < 0 ? year : year - 1;
}

function axisToYear(axis: number): number {
  return axis < 0 ? axis : axis + 1;
}

function formatRange(entry: ChronicleEntry): string {
  if (entry.startYear === entry.endYear) return formatYear(entry.startYear);
  return `${formatYear(entry.startYear)} - ${formatYear(entry.endYear)}`;
}

function formatYear(year: number): string {
  return String(year);
}

function formatAxisYear(axis: number): string {
  return formatYear(axisToYear(axis));
}
