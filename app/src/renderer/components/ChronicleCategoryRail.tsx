import { useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ChronicleCategoryOption } from "../chronicleCategoryModel";
import { useT } from "../i18n";

interface ChronicleCategoryRailProps {
  collapsed: boolean;
  hiddenCategoryKeys: ReadonlySet<string>;
  onCollapsedChange: (collapsed: boolean) => void;
  onHiddenCategoryKeysChange: (keys: string[]) => void;
  options: ChronicleCategoryOption[];
}

export function ChronicleCategoryRail({
  collapsed,
  hiddenCategoryKeys,
  onCollapsedChange,
  onHiddenCategoryKeysChange,
  options
}: ChronicleCategoryRailProps): ReactElement {
  const t = useT();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOptions = useMemo(() => options.filter((option) => (
    !normalizedQuery || option.label.toLocaleLowerCase().includes(normalizedQuery)
  )), [normalizedQuery, options]);
  const totalCount = options.reduce((sum, option) => sum + option.count, 0);
  const visibleCount = options.reduce((sum, option) => (
    hiddenCategoryKeys.has(option.key) ? sum : sum + option.count
  ), 0);
  const hiddenCount = totalCount - visibleCount;

  const toggleCategory = (key: string): void => {
    const next = new Set(hiddenCategoryKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onHiddenCategoryKeysChange([...next]);
  };

  if (collapsed) {
    return (
      <aside className="chronicle-category-rail chronicle-category-rail--collapsed">
        <button
          aria-expanded="false"
          aria-label={t("chronicle.expandCategories")}
          className="chronicle-category-collapse"
          data-filtered={hiddenCount > 0 || undefined}
          onClick={() => onCollapsedChange(false)}
          type="button"
        >
          <span aria-hidden="true" className="chronicle-category-collapse-icon">›</span>
          {hiddenCount > 0 ? <span className="chronicle-category-badge">{hiddenCategoryKeys.size}</span> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside aria-label={t("chronicle.categories")} className="chronicle-category-rail">
      <div className="chronicle-category-header">
        <h2>{t("chronicle.categories")}</h2>
        <button
          aria-expanded="true"
          aria-label={t("chronicle.collapseCategories")}
          className="chronicle-category-collapse"
          onClick={() => onCollapsedChange(true)}
          type="button"
        >
          <span aria-hidden="true" className="chronicle-category-collapse-icon">‹</span>
        </button>
      </div>
      <div className="chronicle-category-search-wrap">
        <input
          aria-label={t("chronicle.categorySearch")}
          className="chronicle-category-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder={t("chronicle.categorySearchPlaceholder")}
          type="search"
          value={query}
        />
      </div>
      <div className="chronicle-category-actions">
        <button
          disabled={hiddenCategoryKeys.size === 0}
          onClick={() => onHiddenCategoryKeysChange([])}
          type="button"
        >
          {t("chronicle.showAllCategories")}
        </button>
        <button
          disabled={hiddenCategoryKeys.size === options.length}
          onClick={() => onHiddenCategoryKeysChange(options.map((option) => option.key))}
          type="button"
        >
          {t("chronicle.hideAllCategories")}
        </button>
      </div>
      <div className="chronicle-category-list">
        {filteredOptions.map((option) => {
          const visible = !hiddenCategoryKeys.has(option.key);
          const markerColor = option.paletteIndex === null
            ? "var(--chronicle-category-uncategorized)"
            : `var(--chronicle-category-${option.paletteIndex})`;
          return (
            <button
              aria-pressed={visible}
              className="chronicle-category-option"
              key={option.key}
              onClick={() => toggleCategory(option.key)}
              style={{ "--chronicle-category-color": markerColor } as CSSProperties}
              type="button"
            >
              <span aria-hidden="true" className="chronicle-category-marker" />
              <span className="chronicle-category-name">{option.label}</span>
              <span className="chronicle-category-count">{option.count}</span>
              <span aria-hidden="true" className="chronicle-category-visibility">{visible ? "●" : "○"}</span>
            </button>
          );
        })}
        {filteredOptions.length === 0 ? (
          <p className="chronicle-category-no-results">{t("chronicle.noMatchingCategories")}</p>
        ) : null}
      </div>
      <div className="chronicle-category-summary">
        {t("chronicle.visibleCategorySummary", { total: totalCount, visible: visibleCount })}
      </div>
    </aside>
  );
}
