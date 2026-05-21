import type { ReactElement } from "react";

import type { TimelineChartSource } from "../../shared/ipc";
import {
  timelineSummaryForRow,
  rowCenterValue,
  type ChartRow
} from "../timelineTimeline";
import { useT } from "../i18n";

export function TimelineNameColumn({
  activeSource,
  axisHeight,
  nameColumnWidth,
  onJump,
  onOpenCard,
  rows
}: {
  activeSource: TimelineChartSource;
  axisHeight: number;
  nameColumnWidth: number;
  onJump: (value: number) => void;
  onOpenCard: (path: string) => void;
  rows: ChartRow[];
}): ReactElement {
  const t = useT();
  void activeSource;

  return (
    <div className="timeline-name-column" style={{ width: nameColumnWidth }}>
      <div className="timeline-name-header timeline-name-header--timeline" style={{ height: axisHeight }}>
        <span />
        <span>{t("timeline.period")}</span>
      </div>
      {rows.length === 0 ? (
        <div className="timeline-card-name-row timeline-card-name-row--empty">
          <div className="timeline-card-name timeline-card-name--empty">{t("timeline.empty")}</div>
        </div>
      ) : (
        rows.map((row) => (
          <div
            className="timeline-card-name-row timeline-card-name-row--timeline"
            key={row.key}
          >
            <button
              className="timeline-card-name"
              onClick={() => onOpenCard(row.path)}
              title={row.path}
              type="button"
            >
              {row.cardName}
            </button>
            <button
              className="timeline-year-summary"
              onClick={() => onJump(rowCenterValue(row))}
              title={t("timeline.jumpToPeriod")}
              type="button"
            >
              {timelineSummaryForRow(row)}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
