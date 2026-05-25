import type { ReactElement } from "react";

import type { ChartSource } from "../../shared/ipc";
import {
  chronicleSummaryForRow,
  dateSummaryForRow,
  rowCenterValue,
  type ChartRow
} from "../chronicleTimeline";
import { useT } from "../i18n";

export function ChronicleNameColumn({
  activeSource,
  dateAxisHeight,
  nameColumnWidth,
  onJump,
  onOpenFile,
  rows
}: {
  activeSource: ChartSource;
  dateAxisHeight: number;
  nameColumnWidth: number;
  onJump: (value: number) => void;
  onOpenFile: (path: string) => void;
  rows: ChartRow[];
}): ReactElement {
  const t = useT();

  return (
    <div className="chronicle-name-column" style={{ width: nameColumnWidth }}>
      <div className={`chronicle-name-header${activeSource === "date" ? " chronicle-name-header--date" : " chronicle-name-header--chronicle"}`} style={{ height: dateAxisHeight }}>
        {activeSource === "date" ? (
          <>
            <span />
            <span>{t("chronicle.plannedDate")}</span>
            <span>{t("chronicle.actualDate")}</span>
          </>
        ) : (
          <>
            <span />
            <span>{t("chronicle.period")}</span>
          </>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="chronicle-file-name-row chronicle-file-name-row--empty">
          <div className="chronicle-file-name chronicle-file-name--empty">{t("chronicle.empty")}</div>
        </div>
      ) : (
        rows.map((row) => (
          <div
            className={`chronicle-file-name-row${activeSource === "date" ? " chronicle-file-name-row--date" : " chronicle-file-name-row--chronicle"}`}
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
            {activeSource === "date" ? (
              <>
                <span className="chronicle-date-summary chronicle-date-summary--planned">
                  {dateSummaryForRow(row, "planned")}
                </span>
                <span className="chronicle-date-summary chronicle-date-summary--actual">
                  {dateSummaryForRow(row, "actual")}
                </span>
              </>
            ) : (
              <button
                className="chronicle-year-summary"
                onClick={() => onJump(rowCenterValue(row))}
                title={t("chronicle.jumpToPeriod")}
                type="button"
              >
                {chronicleSummaryForRow(row)}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
