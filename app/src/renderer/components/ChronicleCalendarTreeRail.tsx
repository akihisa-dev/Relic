import { useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ChronicleCalendarTreeNode } from "../chronicleCalendarTreeModel";
import { useT } from "../i18n";

interface ChronicleCalendarTreeRailProps {
  collapsed: boolean;
  nodes: ChronicleCalendarTreeNode[];
  onCollapsedChange: (collapsed: boolean) => void;
  onOpenFile: (path: string) => void;
}

export function ChronicleCalendarTreeRail({
  collapsed,
  nodes,
  onCollapsedChange,
  onOpenFile
}: ChronicleCalendarTreeRailProps): ReactElement {
  const t = useT();
  const [query, setQuery] = useState("");
  const [collapsedCalendars, setCollapsedCalendars] = useState<ReadonlySet<string>>(new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredNodes = useMemo(() => nodes.flatMap((node) => {
    if (!normalizedQuery || node.calendarName.toLocaleLowerCase().includes(normalizedQuery)) return [node];
    const files = node.files.filter((file) => (
      file.fileName.toLocaleLowerCase().includes(normalizedQuery) ||
      file.path.toLocaleLowerCase().includes(normalizedQuery)
    ));
    return files.length > 0 ? [{ ...node, files }] : [];
  }), [nodes, normalizedQuery]);

  const toggleCalendar = (calendarName: string): void => {
    setCollapsedCalendars((current) => {
      const next = new Set(current);
      if (next.has(calendarName)) next.delete(calendarName);
      else next.add(calendarName);
      return next;
    });
  };

  if (collapsed) {
    return (
      <aside className="chronicle-calendar-tree-rail chronicle-calendar-tree-rail--collapsed">
        <button
          aria-expanded="false"
          aria-label={t("chronicle.expandCalendarTree")}
          className="chronicle-calendar-tree-collapse"
          onClick={() => onCollapsedChange(false)}
          type="button"
        >
          <span aria-hidden="true" className="chronicle-calendar-tree-collapse-icon">›</span>
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label={t("chronicle.calendars")} className="chronicle-calendar-tree-rail">
      <div className="chronicle-calendar-tree-header">
        <h2>{t("chronicle.calendars")}</h2>
        <button
          aria-expanded="true"
          aria-label={t("chronicle.collapseCalendarTree")}
          className="chronicle-calendar-tree-collapse"
          onClick={() => onCollapsedChange(true)}
          type="button"
        >
          <span aria-hidden="true" className="chronicle-calendar-tree-collapse-icon">‹</span>
        </button>
      </div>
      <div className="chronicle-calendar-tree-search-wrap">
        <input
          aria-label={t("chronicle.calendarTreeSearch")}
          className="chronicle-calendar-tree-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder={t("chronicle.calendarTreeSearchPlaceholder")}
          type="search"
          value={query}
        />
      </div>
      <div className="chronicle-calendar-tree-list">
        {filteredNodes.map((node) => {
          const isExpanded = normalizedQuery.length > 0 || !collapsedCalendars.has(node.calendarName);
          const markerColor = node.hue === null
            ? "var(--chronicle-category-uncategorized)"
            : `hsl(${node.hue} var(--chronicle-category-saturation) var(--chronicle-category-lightness))`;
          return (
            <section
              className="chronicle-calendar-tree-group"
              key={node.calendarName}
              style={{ "--chronicle-calendar-color": markerColor } as CSSProperties}
            >
              <button
                aria-expanded={isExpanded}
                aria-label={t(isExpanded ? "chronicle.collapseCalendar" : "chronicle.expandCalendar", { name: node.calendarName })}
                className="chronicle-calendar-tree-calendar"
                onClick={() => toggleCalendar(node.calendarName)}
                type="button"
              >
                <span aria-hidden="true" className="chronicle-calendar-tree-disclosure">{isExpanded ? "⌄" : "›"}</span>
                <span aria-hidden="true" className="chronicle-calendar-tree-marker" />
                <span className="chronicle-calendar-tree-name">{node.calendarName}</span>
                <span className="chronicle-calendar-tree-count">{node.files.length}</span>
              </button>
              {isExpanded ? (
                <div className="chronicle-calendar-tree-files">
                  {node.files.map((file) => (
                    <button
                      className="chronicle-calendar-tree-file"
                      key={file.path}
                      onClick={() => onOpenFile(file.path)}
                      title={file.path}
                      type="button"
                    >
                      <span aria-hidden="true" className="chronicle-calendar-tree-branch" />
                      <span>{file.fileName}</span>
                    </button>
                  ))}
                  {node.files.length === 0 ? (
                    <p className="chronicle-calendar-tree-empty">{t("chronicle.noCalendarFiles")}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
        {filteredNodes.length === 0 ? (
          <p className="chronicle-calendar-tree-no-results">{t("chronicle.noMatchingCalendarFiles")}</p>
        ) : null}
      </div>
    </aside>
  );
}
