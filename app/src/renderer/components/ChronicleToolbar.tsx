import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import type { ChronicleSortKey } from "../chronicleTimeline";
import { useT } from "../i18n";

export interface ChronicleToolbarProps {
  activeChart: WorkspaceGanttChart | null;
  activeSource: GanttChartSource;
  availableCharts: WorkspaceGanttChart[];
  fitChronicleOverview: () => void;
  query: string;
  scrollToToday: () => void;
  selectChart: (chart: WorkspaceGanttChart) => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSortKey: Dispatch<SetStateAction<ChronicleSortKey>>;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  setZoomIndex: Dispatch<SetStateAction<number>>;
  sortKey: ChronicleSortKey;
  statusFilter: string;
  statusOptions: string[];
  zoomIndex: number;
  zoomLevel: number;
  zoomOptions: readonly number[];
}

export function ChronicleToolbar({
  activeChart,
  activeSource,
  availableCharts,
  fitChronicleOverview,
  query,
  scrollToToday,
  selectChart,
  setQuery,
  setSortKey,
  setStatusFilter,
  setZoomIndex,
  sortKey,
  statusFilter,
  statusOptions,
  zoomIndex,
  zoomLevel,
  zoomOptions
}: ChronicleToolbarProps): ReactElement {
  const t = useT();
  const zoomLabel = `${Math.round(zoomLevel * 100)}%`;

  return (
    <div className="chronicle-toolbar">
      <div className="chronicle-source-buttons" aria-label={t("chronicle.source")}>
        {availableCharts.map((candidate) => (
          <button
            aria-pressed={candidate.id === activeChart?.id}
            className={`chronicle-source-button${candidate.id === activeChart?.id ? " active" : ""}`}
            key={candidate.id}
            onClick={() => selectChart(candidate)}
            type="button"
          >
            {candidate.source}
          </button>
        ))}
      </div>
      <label className="chronicle-search">
        <span>{t("chronicle.search")}</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("chronicle.searchPlaceholder")}
          type="search"
          value={query}
        />
      </label>
      <label className="chronicle-search chronicle-sort">
        <span>{t("chronicle.sort")}</span>
        <select onChange={(event) => setSortKey(event.target.value as ChronicleSortKey)} value={sortKey}>
          <option value="start-asc">{t("chronicle.sortStartAsc")}</option>
          <option value="start-desc">{t("chronicle.sortStartDesc")}</option>
          <option value="name-asc">{t("chronicle.sortNameAsc")}</option>
          <option value="name-desc">{t("chronicle.sortNameDesc")}</option>
        </select>
      </label>
      {activeSource === "date" && statusOptions.length > 0 ? (
        <label className="chronicle-search chronicle-status-filter">
          <span>{t("chronicle.status")}</span>
          <select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">{t("chronicle.statusAll")}</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="chronicle-zoom" aria-label={t("chronicle.zoom")}>
        {activeSource === "date" ? (
          <button
            className="chronicle-today-button"
            onClick={scrollToToday}
            type="button"
          >
            {t("chronicle.today")}
          </button>
        ) : activeSource === "chronicle" ? (
          <button
            className="chronicle-today-button"
            onClick={fitChronicleOverview}
            type="button"
          >
            {t("chronicle.fitAll")}
          </button>
        ) : null}
        <button
          aria-label={t("chronicle.zoomOut")}
          className="chronicle-zoom-button"
          disabled={zoomIndex === 0}
          onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          -
        </button>
        <span className="chronicle-zoom-value">{zoomLabel}</span>
        <button
          aria-label={t("chronicle.zoomIn")}
          className="chronicle-zoom-button"
          disabled={zoomIndex >= zoomOptions.length - 1}
          onClick={() => setZoomIndex((current) => Math.min(zoomOptions.length - 1, current + 1))}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
