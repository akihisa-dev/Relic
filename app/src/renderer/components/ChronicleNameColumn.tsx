import type { ReactElement } from "react";

import type { GanttChartSource } from "../../shared/ipc";
import {
  chronicleSummaryForRow,
  rowCenterValue,
  type ChartRow
} from "../chronicleTimeline";
import { useT } from "../i18n";

export function ChronicleNameColumn({
  activeSource,
  axisHeight,
  nameColumnWidth,
  onJump,
  onOpenFile,
  rows
}: {
  activeSource: GanttChartSource;
  axisHeight: number;
  nameColumnWidth: number;
  onJump: (value: number) => void;
  onOpenFile: (path: string) => void;
  rows: ChartRow[];
}): ReactElement {
  const t = useT();
  void activeSource;

  return (
    <div className="chronicle-name-column" style={{ width: nameColumnWidth }}>
      <div className="chronicle-name-header chronicle-name-header--chronicle" style={{ height: axisHeight }}>
        <span />
        <span>{t("chronicle.period")}</span>
      </div>
      {rows.length === 0 ? (
        <div className="chronicle-file-name-row chronicle-file-name-row--empty">
          <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
        </div>
      ) : (
        rows.map((row) => (
          <div
            className="chronicle-file-name-row chronicle-file-name-row--chronicle"
            key={row.key}
          >
            <button
              className="chronicle-file-name"
              onClick={() => onOpenFile(row.path)}
              title={row.path}
              type="button"
            >
              {row.fileName}
            </button>
            <button
              className="chronicle-year-summary"
              onClick={() => onJump(rowCenterValue(row))}
              title={t("chronicle.jumpToPeriod")}
              type="button"
            >
              {chronicleSummaryForRow(row)}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
