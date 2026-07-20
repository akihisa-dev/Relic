import { useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ChronicleCalendarTreeNode } from "../chronicleCalendarTreeModel";
import { useT } from "../i18n";

interface ChronicleCalendarTreeRailProps {
  baseCalendarName: string;
  collapsed: boolean;
  hiddenCategoryKeys: ReadonlySet<string>;
  nodes: ChronicleCalendarTreeNode[];
  onCalendarVisibilityChange: (calendarName: string, visible: boolean) => void;
  onCategoryVisibilityChange: (visibilityKey: string, visible: boolean) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  visibleCalendarNames: ReadonlySet<string>;
}

export function ChronicleCalendarTreeRail({
  baseCalendarName,
  collapsed,
  hiddenCategoryKeys,
  nodes,
  onCalendarVisibilityChange,
  onCategoryVisibilityChange,
  onCollapsedChange,
  visibleCalendarNames
}: ChronicleCalendarTreeRailProps): ReactElement {
  const t = useT();
  const [query, setQuery] = useState("");
  const [collapsedCalendars, setCollapsedCalendars] = useState<ReadonlySet<string>>(new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredNodes = useMemo(() => nodes.flatMap((node) => {
    if (!normalizedQuery || node.calendarName.toLocaleLowerCase().includes(normalizedQuery)) return [node];
    const categories = node.categories.filter((category) => category.label.toLocaleLowerCase().includes(normalizedQuery));
    return categories.length > 0 ? [{ ...node, categories }] : [];
  }), [nodes, normalizedQuery]);

  const toggleCalendarExpansion = (calendarName: string): void => {
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
          const isBaseCalendar = node.calendarName === baseCalendarName;
          const hasVisibleCategory = node.categories.some((category) => !hiddenCategoryKeys.has(category.visibilityKey));
          const isVisible = isBaseCalendar
            ? node.categories.length === 0 || hasVisibleCategory
            : visibleCalendarNames.has(node.calendarName);
          const isExpanded = normalizedQuery.length > 0 || !collapsedCalendars.has(node.calendarName);
          const markerColor = node.hue === null
            ? "var(--chronicle-category-uncategorized)"
            : `hsl(${node.hue} var(--chronicle-category-saturation) var(--chronicle-category-lightness))`;
          return (
            <section
              className={`chronicle-calendar-tree-group${isVisible ? "" : " chronicle-calendar-tree-group--hidden"}`}
              key={node.calendarName}
              style={{ "--chronicle-calendar-color": markerColor } as CSSProperties}
            >
              <div className="chronicle-calendar-tree-calendar-row">
                <button
                  aria-expanded={isExpanded}
                  aria-label={t(isExpanded ? "chronicle.collapseCalendar" : "chronicle.expandCalendar", { name: node.calendarName })}
                  className="chronicle-calendar-tree-calendar"
                  onClick={() => toggleCalendarExpansion(node.calendarName)}
                  type="button"
                >
                  <span aria-hidden="true" className="chronicle-calendar-tree-disclosure">{isExpanded ? "⌄" : "›"}</span>
                  <span aria-hidden="true" className="chronicle-calendar-tree-marker" />
                  <span className="chronicle-calendar-tree-name">{node.calendarName}</span>
                  <span className="chronicle-calendar-tree-count">{node.categories.length}</span>
                </button>
                <button
                  aria-label={t(isVisible ? "chronicle.hideCalendar" : "chronicle.showCalendar", { name: node.calendarName })}
                  aria-pressed={isVisible}
                  className="chronicle-calendar-tree-visibility"
                  disabled={isBaseCalendar && node.categories.length === 0}
                  onClick={() => onCalendarVisibilityChange(node.calendarName, !isVisible)}
                  type="button"
                >
                  <span aria-hidden="true">{isVisible ? "●" : "○"}</span>
                </button>
              </div>
              {isExpanded ? (
                <div className="chronicle-calendar-tree-categories">
                  {node.categories.map((category) => {
                    const categoryVisible = !hiddenCategoryKeys.has(category.visibilityKey);
                    const categoryColor = category.hue === null
                      ? "var(--chronicle-category-uncategorized)"
                      : `hsl(${category.hue} var(--chronicle-category-saturation) var(--chronicle-category-lightness))`;
                    return (
                      <button
                        aria-label={t(categoryVisible ? "chronicle.hideCategory" : "chronicle.showCategory", { name: category.label })}
                        aria-pressed={categoryVisible}
                        className={`chronicle-calendar-tree-category${categoryVisible ? "" : " chronicle-calendar-tree-category--hidden"}`}
                        key={category.visibilityKey}
                        onClick={() => onCategoryVisibilityChange(category.visibilityKey, !categoryVisible)}
                        style={{ "--chronicle-tree-category-color": categoryColor } as CSSProperties}
                        type="button"
                      >
                        <span aria-hidden="true" className="chronicle-calendar-tree-category-marker" />
                        <span className="chronicle-calendar-tree-name">{category.label}</span>
                        <span className="chronicle-calendar-tree-count">{category.count}</span>
                        <span aria-hidden="true" className="chronicle-calendar-tree-category-visibility">{categoryVisible ? "●" : "○"}</span>
                      </button>
                    );
                  })}
                  {node.categories.length === 0 ? (
                    <p className="chronicle-calendar-tree-empty">{t("chronicle.noCalendarCategories")}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
        {filteredNodes.length === 0 ? (
          <p className="chronicle-calendar-tree-no-results">{t("chronicle.noMatchingCalendarCategories")}</p>
        ) : null}
      </div>
    </aside>
  );
}
