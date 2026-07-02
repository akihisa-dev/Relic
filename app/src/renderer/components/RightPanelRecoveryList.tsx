import { useEffect, useState, type ReactElement } from "react";

import type { FileRecoveryEntry } from "../../shared/ipc";
import { useT } from "../i18n";
import type { FileTab } from "../store/editorStore";

interface RightPanelRecoveryListProps {
  activeFileTab: FileTab | null;
  onRecoverContent: (tabId: string, content: string) => void;
}

export function RightPanelRecoveryList({
  activeFileTab,
  onRecoverContent
}: RightPanelRecoveryListProps): ReactElement {
  const t = useT();
  const [entries, setEntries] = useState<FileRecoveryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const path = activeFileTab?.path ?? null;

  useEffect(() => {
    if (!path || !window.relic) {
      setEntries([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void window.relic.listFileRecoverySnapshots({ path }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setEntries(result.value);
      } else {
        setError(result.error.message);
        setEntries([]);
      }
    }).catch((reason) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      setEntries([]);
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [path]);

  const recover = (entry: FileRecoveryEntry): void => {
    if (!activeFileTab || !window.relic) return;

    setRecoveringId(entry.id);
    setError(null);

    void window.relic.readFileRecoverySnapshot({
      path: activeFileTab.path,
      snapshotId: entry.id
    }).then((result) => {
      if (result.ok) {
        onRecoverContent(activeFileTab.id, result.value.content);
      } else {
        setError(result.error.message);
      }
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => setRecoveringId(null));
  };

  if (!activeFileTab) {
    return <div className="empty-note">{t("recovery.noFile")}</div>;
  }

  return (
    <div className="recovery-panel-stack">
      <div className="right-frontmatter-file" title={activeFileTab.path}>{activeFileTab.name}</div>
      {isLoading ? (
        <div className="list-loading-note">{t("common.loading")}</div>
      ) : null}
      {error ? (
        <div className="empty-note">{error}</div>
      ) : null}
      {!isLoading && !error && entries.length === 0 ? (
        <div className="empty-note">{t("recovery.empty")}</div>
      ) : null}
      {entries.length > 0 ? (
        <ul className="recovery-list">
          {entries.map((entry) => (
            <li className="recovery-list-item" key={entry.id}>
              <div className="recovery-list-meta">
                <span>{formatDateTime(entry.createdAt)}</span>
                <span>{formatBytes(entry.size)}</span>
              </div>
              <button
                className="secondary-button recovery-list-restore"
                disabled={recoveringId === entry.id}
                onClick={() => recover(entry)}
                type="button"
              >
                {recoveringId === entry.id ? t("common.running") : t("recovery.load")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}
