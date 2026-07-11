import { useEffect, useMemo, useRef, type ReactElement } from "react";

import type { ChartEntry } from "../../shared/ipc";
import { rightPanelChronicleEntries } from "../rightPanelChronicle";
import type { FileTab } from "../store/editorStore";
import { useT } from "../i18n";

interface RightPanelChronicleProps {
  activeFileTab: FileTab | null;
  entries: ChartEntry[];
  onOpenFile: (path: string) => void;
}

export function RightPanelChronicle({ activeFileTab, entries, onOpenFile }: RightPanelChronicleProps): ReactElement {
  const t = useT();
  const activeRef = useRef<HTMLLIElement | null>(null);
  const timelineEntries = useMemo(
    () => rightPanelChronicleEntries(entries, activeFileTab),
    [activeFileTab?.content, activeFileTab?.name, activeFileTab?.path, entries]
  );

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center" });
  }, [activeFileTab?.path, timelineEntries]);

  if (timelineEntries.length === 0) {
    return <div className="empty-note">{t("chronicle.empty")}</div>;
  }

  return (
    <ol className="right-panel-chronicle-list">
      {timelineEntries.map((entry, index) => {
        const active = entry.path === activeFileTab?.path;
        const previous = timelineEntries[index - 1];
        const yearGap = previous ? Math.trunc(entry.startValue / 12) - Math.trunc(previous.startValue / 12) : null;
        return (
          <li
            className={`right-panel-chronicle-item${active ? " right-panel-chronicle-item--active" : ""}`}
            key={`${entry.path}-${entry.startValue}-${entry.endValue}`}
            ref={active ? activeRef : undefined}
          >
            {yearGap && yearGap > 0 ? (
              <div className="right-panel-chronicle-gap">{t("chronicle.yearsLater", { count: yearGap })}</div>
            ) : null}
            <div className="right-panel-chronicle-row">
              <span className="right-panel-chronicle-date">
                {entry.startLabel === entry.endLabel ? entry.startLabel : `${entry.startLabel}–${entry.endLabel}`}
              </span>
              <button
                aria-current={active ? "true" : undefined}
                className="right-panel-chronicle-file"
                onClick={() => onOpenFile(entry.path)}
                title={entry.path}
                type="button"
              >
                {entry.fileName}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
