import { relicClient } from "../relicClient";
import { useEffect, useState, type ReactElement } from "react";

import type { FileRecoveryEntry } from "../../shared/ipc";
import { useAsyncRequestGuard } from "../hooks/useAsyncRequestGuard";
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
  const tabId = activeFileTab?.id ?? null;
  const beginEntriesRequest = useAsyncRequestGuard([path]);
  const beginRecoveryRequest = useAsyncRequestGuard([tabId, path]);

  useEffect(() => {
    setRecoveringId(null);
    setError(null);
  }, [path, tabId]);

  useEffect(() => {
    const client = relicClient.current;
    if (!path || !client) {
      setEntries([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    const isCurrentRequest = beginEntriesRequest();
    setIsLoading(true);
    setError(null);

    void client.listFileRecoverySnapshots({ path }).then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) {
        setEntries(result.value);
      } else {
        setError(result.error.message);
        setEntries([]);
      }
    }).catch((reason) => {
      if (!isCurrentRequest()) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      setEntries([]);
    }).finally(() => {
      if (isCurrentRequest()) setIsLoading(false);
    });
  }, [beginEntriesRequest, path]);

  const recover = (entry: FileRecoveryEntry): void => {
    const client = relicClient.current;
    if (!activeFileTab || !client) return;

    const targetPath = activeFileTab.path;
    const targetTabId = activeFileTab.id;
    const isCurrentRequest = beginRecoveryRequest();
    setRecoveringId(entry.id);
    setError(null);

    void client.readFileRecoverySnapshot({
      path: targetPath,
      snapshotId: entry.id
    }).then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) {
        onRecoverContent(targetTabId, result.value.content);
      } else {
        setError(result.error.message);
      }
    }).catch((reason) => {
      if (!isCurrentRequest()) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (isCurrentRequest()) setRecoveringId(null);
    });
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

const recoveryDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return recoveryDateTimeFormatter.format(date);
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}
