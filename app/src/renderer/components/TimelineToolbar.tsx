import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { TimelineChartSource, CardbookTimelineChart } from "../../shared/ipc";
import type { TimelineSortKey } from "../timelineTimeline";
import { useT } from "../i18n";

export interface TimelineToolbarProps {
  activeChart: CardbookTimelineChart | null;
  activeSource: TimelineChartSource;
  availableCharts: CardbookTimelineChart[];
  refreshRowOrder: () => void;
  query: string;
  scrollToToday: () => void;
  selectChart: (chart: CardbookTimelineChart) => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSortKey: Dispatch<SetStateAction<TimelineSortKey>>;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  sortKey: TimelineSortKey;
  statusFilter: string;
  statusOptions: string[];
}

export function TimelineToolbar({
  activeChart,
  activeSource,
  availableCharts,
  refreshRowOrder,
  query,
  scrollToToday,
  selectChart,
  setQuery,
  setSortKey,
  setStatusFilter,
  sortKey,
  statusFilter,
  statusOptions
}: TimelineToolbarProps): ReactElement {
  const t = useT();
  void activeSource;
  void scrollToToday;
  void setStatusFilter;
  void statusFilter;
  void statusOptions;

  return (
    <div className="timeline-toolbar">
      <div className="timeline-source-buttons" aria-label={t("timeline.source")}>
        {availableCharts.map((candidate) => (
          <button
            aria-pressed={candidate.id === activeChart?.id}
            className={`timeline-source-button${candidate.id === activeChart?.id ? " active" : ""}`}
            key={candidate.id}
            onClick={() => selectChart(candidate)}
            type="button"
          >
            {candidate.source === "timeline" ? t("timeline.source") : candidate.name}
          </button>
        ))}
      </div>
      <label className="timeline-search">
        <span>{t("timeline.search")}</span>
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("timeline.searchPlaceholder")}
          type="search"
          value={query}
        />
      </label>
      <label className="timeline-search timeline-sort">
        <span>{t("timeline.sort")}</span>
        <select onChange={(event) => setSortKey(event.target.value as TimelineSortKey)} value={sortKey}>
          <option value="start-asc">{t("timeline.sortStartAsc")}</option>
          <option value="start-desc">{t("timeline.sortStartDesc")}</option>
          <option value="name-asc">{t("timeline.sortNameAsc")}</option>
          <option value="name-desc">{t("timeline.sortNameDesc")}</option>
        </select>
      </label>
      <button
        aria-label={t("timeline.refreshOrder")}
        className="timeline-icon-button"
        onClick={refreshRowOrder}
        title={t("timeline.refreshOrder")}
        type="button"
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

function RefreshIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
