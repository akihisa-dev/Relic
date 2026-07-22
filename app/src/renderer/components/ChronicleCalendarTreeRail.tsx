import { useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ChronicleCategoryOption } from "../chronicleCategoryModel";
import type { ChronicleCalendarTreeNode } from "../chronicleCalendarTreeModel";
import { useT } from "../i18n";

interface ChronicleCalendarTreeRailProps {
  baseCalendarName: string;
  collapsed: boolean;
  globalCategories: ChronicleCategoryOption[];
  hiddenCategoryKeys: ReadonlySet<string>;
  nodes: ChronicleCalendarTreeNode[];
  onCalendarVisibilityChange: (calendarName: string, visible: boolean) => void;
  onCategoryVisibilityChange: (visibilityKey: string, visible: boolean) => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onGlobalCategoryVisibilityChange: (categoryKey: string, visible: boolean) => void;
  visibleCalendarNames: ReadonlySet<string>;
}

export function ChronicleCalendarTreeRail({
  baseCalendarName,
  collapsed,
  globalCategories,
  hiddenCategoryKeys,
  nodes,
  onCalendarVisibilityChange,
  onCategoryVisibilityChange,
  onCollapsedChange,
  onGlobalCategoryVisibilityChange,
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
  const filteredGlobalCategories = useMemo(() => globalCategories.filter((category) => (
    !normalizedQuery || category.label.toLocaleLowerCase().includes(normalizedQuery)
  )), [globalCategories, normalizedQuery]);

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
        {filteredGlobalCategories.length > 0 ? (
          <section className="chronicle-calendar-tree-global">
            <h3>{t("chronicle.allCalendarCategories")}</h3>
            <div className="chronicle-calendar-tree-global-categories">
              {filteredGlobalCategories.map((category) => {
                const matchingCategories = nodes.flatMap((node) => (
                  node.categories.filter((candidate) => candidate.key === category.key)
                ));
                const visibleCount = matchingCategories.filter((candidate) => (
                  !hiddenCategoryKeys.has(candidate.visibilityKey)
                )).length;
                const categoryVisible = visibleCount === matchingCategories.length;
                const categoryPartiallyVisible = visibleCount > 0 && !categoryVisible;
                const categoryColor = category.hue === null
                  ? "var(--chronicle-category-uncategorized)"
                  : `hsl(${category.hue} var(--chronicle-category-saturation) var(--chronicle-category-lightness))`;
                return (
                  <button
                    aria-label={t(categoryVisible ? "chronicle.hideCategoryAcrossCalendars" : "chronicle.showCategoryAcrossCalendars", { name: category.label })}
                    aria-pressed={categoryPartiallyVisible ? "mixed" : categoryVisible}
                    className={`chronicle-calendar-tree-category chronicle-calendar-tree-global-category${categoryPartiallyVisible ? " chronicle-calendar-tree-category--partial" : categoryVisible ? "" : " chronicle-calendar-tree-category--hidden"}`}
                    key={category.key}
                    onClick={() => onGlobalCategoryVisibilityChange(category.key, !categoryVisible)}
                    style={{ "--chronicle-tree-category-color": categoryColor } as CSSProperties}
                    type="button"
                  >
                    <span aria-hidden="true" className="chronicle-calendar-tree-category-marker" />
                    <span className="chronicle-calendar-tree-name">{category.label}</span>
                    <span className="chronicle-calendar-tree-count">{category.count}</span>
                    <span aria-hidden="true" className="chronicle-calendar-tree-category-visibility">
                      {categoryVisible ? "●" : categoryPartiallyVisible ? "◐" : "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
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
        {filteredGlobalCategories.length === 0 && filteredNodes.length === 0 ? (
          <p className="chronicle-calendar-tree-no-results">{t("chronicle.noMatchingCalendarCategories")}</p>
        ) : null}
      </div>
    </aside>
  );
}
