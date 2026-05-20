import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { UserDefinedField, WorkspaceTreeNode } from "../../shared/ipc";
import {
  buildDashboardStats,
  buildPropertyDistribution,
  buildTreemapRects,
  donutGradient,
  formatNumber,
  percentage
} from "../dashboardModel";
import type { DashboardStats } from "../dashboardModel";
import { useT } from "../i18n";
import { collectMarkdownPaths } from "../workspacePaths";

export { buildDashboardStats, buildPropertyDistribution, buildTreemapRects } from "../dashboardModel";
export type { DashboardStats } from "../dashboardModel";

interface DashboardPanelProps {
  fileTree: WorkspaceTreeNode[];
  onOpenFile: (path: string) => void;
  userDefinedFields: UserDefinedField[];
  workspaceId: string | null;
}

export function DashboardPanel({ fileTree, onOpenFile, userDefinedFields, workspaceId }: DashboardPanelProps): ReactElement {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [refreshToken, setRefreshToken] = useState(0);
  const filePaths = useMemo(() => collectMarkdownPaths(fileTree), [fileTree]);
  const chartFields = useMemo(
    () => userDefinedFields.filter((field) => field.type === "select" || field.type === "multi-select"),
    [userDefinedFields]
  );

  useEffect(() => {
    const relic = window.relic;
    const dashboardLabels = { rootFolder: t("dashboard.rootFolder") };

    if (!workspaceId || !relic) {
      setStats(buildDashboardStats([], fileTree, dashboardLabels));
      return;
    }

    let canceled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all(filePaths.map((path) => relic.readMarkdownFile({ path }))).then((results) => {
      if (canceled) return;

      const failed = results.find((result) => !result.ok);
      if (failed && !failed.ok) {
        setError(failed.error.message);
      }

      setStats(buildDashboardStats(
        results.flatMap((result) => result.ok ? [result.value] : []),
        fileTree,
        dashboardLabels
      ));
    }).finally(() => {
      if (!canceled) setIsLoading(false);
    });

    return () => {
      canceled = true;
    };
  }, [filePaths, fileTree, refreshToken, t, workspaceId]);

  const maxFolderCount = Math.max(0, ...(stats?.folderDistribution.map((item) => item.count) ?? []));
  const topFiles = stats?.files.slice(0, 8) ?? [];
  const maxTopFileChars = Math.max(0, ...topFiles.map((file) => file.chars));
  const tagTreemapRects = useMemo(() => buildTreemapRects(stats?.tagDistribution ?? []), [stats?.tagDistribution]);
  const selectedField = chartFields.find((field) => field.name === selectedProperty) ?? chartFields[0];
  const propertyDistribution = useMemo(() => buildPropertyDistribution(
    stats?.files ?? [],
    selectedField,
    { other: t("dashboard.propertyOther"), unset: t("dashboard.propertyUnset") }
  ), [selectedField, stats?.files, t]);
  const propertyTotal = propertyDistribution.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    if (chartFields.length === 0) {
      setSelectedProperty("");
      return;
    }

    if (!chartFields.some((field) => field.name === selectedProperty)) {
      setSelectedProperty(chartFields[0].name);
    }
  }, [chartFields, selectedProperty]);

  return (
    <section className="dashboard-panel" aria-label={t("dashboard.title")}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">{t("dashboard.kicker")}</p>
          <h2>{t("dashboard.title")}</h2>
        </div>
        <button
          aria-label={isLoading ? t("common.running") : t("dashboard.refresh")}
          className="dashboard-refresh"
          disabled={isLoading}
          onClick={() => setRefreshToken((value) => value + 1)}
          title={isLoading ? t("common.running") : t("dashboard.refresh")}
          type="button"
        >
          <RefreshIcon />
        </button>
      </header>

      {error ? <div className="dashboard-error">{error}</div> : null}

      <div className="dashboard-metrics" aria-label={t("dashboard.summary")}>
        <Metric label={t("dashboard.files")} value={stats?.totalFiles ?? 0} />
        <Metric label={t("dashboard.characters")} value={stats?.totalChars ?? 0} />
        <Metric label={t("dashboard.links")} value={stats?.totalLinks ?? 0} />
        <Metric label={t("dashboard.tags")} value={stats?.tagDistribution.length ?? 0} />
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-section dashboard-section--wide">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.terrain")}</h3>
            <span>{t("dashboard.average", { count: formatNumber(stats?.averageChars ?? 0) })}</span>
          </div>
          <div className="dashboard-file-bars">
            {topFiles.length === 0 ? (
              <div className="dashboard-empty">{t("dashboard.empty")}</div>
            ) : topFiles.map((file) => (
              <button
                className="dashboard-file-bar"
                key={file.path}
                onClick={() => onOpenFile(file.path)}
                style={{ "--bar-height": `${percentage(file.chars, maxTopFileChars)}%` } as CSSProperties}
                title={`${file.path} / ${formatNumber(file.chars)}`}
                type="button"
              >
                <span className="dashboard-file-bar-fill" />
                <span className="dashboard-file-bar-value">{formatNumber(file.chars)}</span>
                <span className="dashboard-file-bar-label">{file.name.replace(/\.md$/i, "")}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.folders")}</h3>
            <span>{t("dashboard.folderCount", { count: stats?.folderCount ?? 0 })}</span>
          </div>
          <div className="dashboard-bars">
            {(stats?.folderDistribution ?? []).map((item) => (
              <BarRow count={item.count} key={item.label} label={item.label} max={maxFolderCount} />
            ))}
          </div>
        </section>

        <section className="dashboard-section dashboard-property-section">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.propertyDistribution")}</h3>
            <span>{selectedField?.type === "multi-select" ? t("dashboard.propertyOccurrences") : t("dashboard.values")}</span>
          </div>
          {chartFields.length === 0 ? (
            <div className="dashboard-empty">{t("dashboard.propertyNoFields")}</div>
          ) : (
            <>
              <label className="dashboard-property-picker">
                <span>{t("dashboard.propertySelect")}</span>
                <select
                  className="dashboard-property-select"
                  onChange={(event) => setSelectedProperty(event.target.value)}
                  value={selectedField?.name ?? ""}
                >
                  {chartFields.map((field) => (
                    <option key={field.name} value={field.name}>{field.name}</option>
                  ))}
                </select>
              </label>
              <div className="dashboard-donut-layout">
                <div
                  aria-label={t("dashboard.propertyDistribution")}
                  className="dashboard-donut"
                  role="img"
                  style={{ "--donut-gradient": donutGradient(propertyDistribution) } as CSSProperties}
                >
                  <strong>{formatNumber(propertyTotal)}</strong>
                  <span>{selectedField?.type === "multi-select" ? t("dashboard.values") : t("dashboard.files")}</span>
                </div>
                <div className="dashboard-donut-legend">
                  {propertyDistribution.length === 0 ? (
                    <span className="dashboard-muted">{t("dashboard.propertyEmpty")}</span>
                  ) : propertyDistribution.map((entry) => (
                    <div className="dashboard-donut-legend-item" key={entry.label}>
                      <span style={{ background: entry.color }} />
                      <b>{entry.label}</b>
                      <small>{entry.count}</small>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="dashboard-section dashboard-section--wide">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.tagsCloud")}</h3>
            <span>{t("dashboard.frontmatter", { count: stats?.frontmatterFiles ?? 0 })}</span>
          </div>
          <div className="dashboard-tag-map">
            {tagTreemapRects.length === 0 ? (
              <span className="dashboard-muted">{t("search.tagsEmpty")}</span>
            ) : tagTreemapRects.map((tag) => (
              <div
                className={`dashboard-tag-map-cell${tag.showLabel ? "" : " dashboard-tag-map-cell--compact"}${tag.textLight ? " dashboard-tag-map-cell--light-text" : ""}`}
                key={tag.label}
                style={{
                  "--cell-height": `${tag.height}%`,
                  "--cell-width": `${tag.width}%`,
                  "--cell-x": `${tag.x}%`,
                  "--cell-y": `${tag.y}%`,
                  "--tag-fill": tag.fill
                } as CSSProperties}
                title={`#${tag.label} / ${tag.count}`}
              >
                {tag.showLabel ? <span>#{tag.label}</span> : null}
                <b>{tag.count}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function RefreshIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="dashboard-metric">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function BarRow({ count, label, max }: { count: number; label: string; max: number }): ReactElement {
  return (
    <div className="dashboard-bar-row">
      <span className="dashboard-bar-label">{label}</span>
      <span className="dashboard-bar-track">
        <span style={{ width: `${percentage(count, max)}%` }} />
      </span>
      <b>{count}</b>
    </div>
  );
}
