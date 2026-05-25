import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { ChartSource } from "../../shared/ipc";
import type { ChronicleSortKey } from "../chronicleTimeline";
import { useT } from "../i18n";

export interface ChronicleToolbarProps {
  activeSource: ChartSource;
  refreshRowOrder: () => void;
  query: string;
  scrollToToday: () => void;
  setQuery: Dispatch<SetStateAction<string>>;
  setSortKey: Dispatch<SetStateAction<ChronicleSortKey>>;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  sortKey: ChronicleSortKey;
  statusFilter: string;
  statusOptions: string[];
}

export function ChronicleToolbar({
  activeSource,
  refreshRowOrder,
  query,
  scrollToToday,
  setQuery,
  setSortKey,
  setStatusFilter,
  sortKey,
  statusFilter,
  statusOptions
}: ChronicleToolbarProps): ReactElement {
  const t = useT();

  return (
    <div className="chronicle-toolbar">
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
      <button
        aria-label={t("chronicle.refreshOrder")}
        className="chronicle-icon-button"
        onClick={refreshRowOrder}
        title={t("chronicle.refreshOrder")}
        type="button"
      >
        <RefreshIcon />
      </button>
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
      {activeSource === "date" ? (
        <div className="chronicle-actions">
          <button
            className="chronicle-today-button"
            onClick={scrollToToday}
            type="button"
          >
            {t("chronicle.today")}
          </button>
        </div>
      ) : null}
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
