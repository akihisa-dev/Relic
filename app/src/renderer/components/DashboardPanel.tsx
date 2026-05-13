import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { parseWikiLinks } from "../../shared/links";
import { parseMarkdownTags } from "../../shared/tags";
import type { WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";
import { collectMarkdownPaths } from "../workspacePaths";

interface DashboardPanelProps {
  fileTree: WorkspaceTreeNode[];
  onOpenFile: (path: string) => void;
  workspaceId: string | null;
}

interface DashboardFileStats {
  chars: number;
  folder: string;
  hasFrontmatter: boolean;
  headings: number;
  links: number;
  name: string;
  path: string;
  tags: string[];
  words: number;
}

export interface DashboardStats {
  averageChars: number;
  files: DashboardFileStats[];
  folderCount: number;
  folderDistribution: Array<{ count: number; label: string }>;
  frontmatterFiles: number;
  lengthBuckets: Array<{ count: number; label: string }>;
  maxChars: number;
  tagDistribution: Array<{ count: number; label: string }>;
  totalChars: number;
  totalFiles: number;
  totalHeadings: number;
  totalLinks: number;
  totalWords: number;
}

interface LoadedMarkdownFile {
  content: string;
  name: string;
  path: string;
}

const lengthBucketDefs = [
  { label: "0-499", max: 499 },
  { label: "500-1,999", max: 1999 },
  { label: "2,000-5,999", max: 5999 },
  { label: "6,000+", max: Infinity }
];

export function buildDashboardStats(
  files: LoadedMarkdownFile[],
  fileTree: WorkspaceTreeNode[]
): DashboardStats {
  const folderCount = countFolders(fileTree);
  const parsedFiles = files.map((file) => {
    const tags = parseMarkdownTags(file.content).tags;
    const headings = (file.content.match(/^#{1,6}\s+\S.*$/gm) ?? []).length;
    const links = parseWikiLinks(file.content).length;
    const folder = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "Root";
    const words = file.content.split(/\s+/).filter(Boolean).length;

    return {
      chars: file.content.length,
      folder,
      hasFrontmatter: /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(file.content),
      headings,
      links,
      name: file.name,
      path: file.path,
      tags,
      words
    };
  });
  const totalChars = parsedFiles.reduce((sum, file) => sum + file.chars, 0);
  const totalWords = parsedFiles.reduce((sum, file) => sum + file.words, 0);
  const totalHeadings = parsedFiles.reduce((sum, file) => sum + file.headings, 0);
  const totalLinks = parsedFiles.reduce((sum, file) => sum + file.links, 0);
  const maxChars = Math.max(0, ...parsedFiles.map((file) => file.chars));

  return {
    averageChars: parsedFiles.length > 0 ? Math.round(totalChars / parsedFiles.length) : 0,
    files: parsedFiles.sort((a, b) => b.chars - a.chars || a.path.localeCompare(b.path, "ja")),
    folderCount,
    folderDistribution: topCounts(parsedFiles.map((file) => file.folder), 8),
    frontmatterFiles: parsedFiles.filter((file) => file.hasFrontmatter).length,
    lengthBuckets: lengthBucketDefs.map((bucket, index) => ({
      count: parsedFiles.filter((file) => (
        file.chars <= bucket.max && (index === 0 || file.chars > lengthBucketDefs[index - 1].max)
      )).length,
      label: bucket.label
    })),
    maxChars,
    tagDistribution: topCounts(parsedFiles.flatMap((file) => file.tags), 12),
    totalChars,
    totalFiles: parsedFiles.length,
    totalHeadings,
    totalLinks,
    totalWords
  };
}

function countFolders(nodes: WorkspaceTreeNode[]): number {
  return nodes.reduce((sum, node) => (
    node.type === "folder" ? sum + 1 + countFolders(node.children) : sum
  ), 0);
}

function topCounts(values: string[], limit: number): Array<{ count: number; label: string }> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ja"))
    .slice(0, limit);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function percentage(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

export function DashboardPanel({ fileTree, onOpenFile, workspaceId }: DashboardPanelProps): ReactElement {
  const t = useT();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const filePaths = useMemo(() => collectMarkdownPaths(fileTree), [fileTree]);

  useEffect(() => {
    const relic = window.relic;

    if (!workspaceId || !relic) {
      setStats(buildDashboardStats([], fileTree));
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
        fileTree
      ));
    }).finally(() => {
      if (!canceled) setIsLoading(false);
    });

    return () => {
      canceled = true;
    };
  }, [filePaths, fileTree, refreshToken, workspaceId]);

  const maxFolderCount = Math.max(0, ...(stats?.folderDistribution.map((item) => item.count) ?? []));
  const maxBucketCount = Math.max(0, ...(stats?.lengthBuckets.map((item) => item.count) ?? []));
  const topFiles = stats?.files.slice(0, 8) ?? [];

  return (
    <section className="dashboard-panel" aria-label={t("dashboard.title")}>
      <header className="dashboard-header">
        <div>
          <p className="dashboard-kicker">{t("dashboard.kicker")}</p>
          <h2>{t("dashboard.title")}</h2>
        </div>
        <button className="dashboard-refresh" disabled={isLoading} onClick={() => setRefreshToken((value) => value + 1)} type="button">
          {isLoading ? t("common.running") : t("dashboard.refresh")}
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
          <div className="dashboard-terrain" aria-hidden="true">
            {topFiles.length === 0 ? (
              <div className="dashboard-empty">{t("dashboard.empty")}</div>
            ) : topFiles.map((file) => (
              <button
                className="dashboard-terrain-bar"
                key={file.path}
                onClick={() => onOpenFile(file.path)}
                style={{ "--bar-height": `${percentage(file.chars, stats?.maxChars ?? 0)}%` } as CSSProperties}
                title={file.path}
                type="button"
              >
                <span />
                <small>{file.name.replace(/\.md$/i, "")}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.lengths")}</h3>
            <span>{t("dashboard.words", { count: formatNumber(stats?.totalWords ?? 0) })}</span>
          </div>
          <div className="dashboard-bars">
            {(stats?.lengthBuckets ?? []).map((item) => (
              <BarRow count={item.count} key={item.label} label={item.label} max={maxBucketCount} />
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

        <section className="dashboard-section">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.tagsCloud")}</h3>
            <span>{t("dashboard.frontmatter", { count: stats?.frontmatterFiles ?? 0 })}</span>
          </div>
          <div className="dashboard-tag-cloud">
            {(stats?.tagDistribution ?? []).length === 0 ? (
              <span className="dashboard-muted">{t("search.tagsEmpty")}</span>
            ) : stats?.tagDistribution.map((tag) => (
              <span className="dashboard-tag" key={tag.label}>
                #{tag.label}
                <b>{tag.count}</b>
              </span>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-title">
            <h3>{t("dashboard.topFiles")}</h3>
            <span>{t("dashboard.headings", { count: stats?.totalHeadings ?? 0 })}</span>
          </div>
          <div className="dashboard-file-list">
            {topFiles.length === 0 ? (
              <div className="dashboard-empty">{t("dashboard.empty")}</div>
            ) : topFiles.map((file) => (
              <button className="dashboard-file-row" key={file.path} onClick={() => onOpenFile(file.path)} title={file.path} type="button">
                <span>{file.name.replace(/\.md$/i, "")}</span>
                <small>{formatNumber(file.chars)}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
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
