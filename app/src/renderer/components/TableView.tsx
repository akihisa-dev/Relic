import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactElement,
  type SetStateAction
} from "react";

import type {
  FrontmatterCategoryChoice,
  WorkspaceTable,
  WorkspaceTableRow,
  WorkspaceTableValue
} from "../../shared/ipc";
import { FIXED_FIELDS } from "../frontmatterSettingsModel";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";
import {
  directoryForPath,
  duplicateFileNames,
  nextTableSort,
  sortTableRows,
  visibleTableRange,
  type TableSort
} from "../table/tableViewModel";
import { resetWorkspaceTableCache } from "../table/workspaceTableLoader";
import { useWorkspaceTableState } from "../table/useWorkspaceTableState";
import { TableFixedPropertyReferenceList, TablePropertyPopover } from "./TablePropertyPopover";

const rowHeight = 48;

export function TableView({
  categoryChoices = [],
  onCategoryChoicesSave = () => undefined,
  onOpenFile,
  refreshRevision,
  workspaceId
}: {
  categoryChoices?: FrontmatterCategoryChoice[];
  onCategoryChoicesSave?: (choices: FrontmatterCategoryChoice[]) => void;
  onOpenFile: (path: string) => void;
  refreshRevision: number;
  workspaceId: string;
}): ReactElement {
  const t = useT();
  const [retryRevision, setRetryRevision] = useState(0);
  const [sort, setSort] = useState<TableSort>({ direction: "asc", property: null });
  const state = useWorkspaceTableState({
    loadFailedMessage: t("table.loadFailed"),
    refreshRevision: refreshRevision * 1000 + retryRevision,
    workspaceId
  });

  useEffect(() => {
    setSort({ direction: "asc", property: null });
  }, [workspaceId]);

  if (state.status === "loading") {
    return <div className="table-view-status">{t("common.loading")}</div>;
  }
  if (state.status === "error") {
    return (
      <div className="table-view-status table-view-status--error">
        <p>{state.message}</p>
        <button onClick={() => {
          resetWorkspaceTableCache();
          setRetryRevision((revision) => revision + 1);
        }} type="button">{t("table.retry")}</button>
      </div>
    );
  }
  if (state.table.rows.length === 0) {
    return (
      <section aria-label={t("table.title")} className="table-view table-view--empty">
        <h3>{t("table.emptyTitle")}</h3>
        <p>{t("table.emptyDescription")}</p>
      </section>
    );
  }

  return (
    <ReadyTable
      categoryChoices={categoryChoices}
      key={workspaceId}
      onCategoryChoicesSave={onCategoryChoicesSave}
      onOpenFile={onOpenFile}
      setSort={setSort}
      sort={sort}
      table={state.table}
    />
  );
}

function ReadyTable({ categoryChoices, onCategoryChoicesSave, onOpenFile, setSort, sort, table }: {
  categoryChoices: FrontmatterCategoryChoice[];
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
  onOpenFile: (path: string) => void;
  setSort: Dispatch<SetStateAction<TableSort>>;
  sort: TableSort;
  table: WorkspaceTable;
}): ReactElement {
  const t = useT();
  const [selectedProperties, setSelectedProperties] = useState(table.selectedProperties);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [columnReferenceProperty, setColumnReferenceProperty] = useState<string | null>(null);
  const [openProperty, setOpenProperty] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => sortTableRows(table.rows, sort), [sort, table.rows]);
  const duplicateNames = useMemo(() => duplicateFileNames(table.rows), [table.rows]);
  const filteredProperties = useMemo(() => table.availableProperties.filter((property) => (
    property.toLocaleLowerCase().includes(propertySearch.trim().toLocaleLowerCase())
  )), [propertySearch, table.availableProperties]);
  const range = visibleTableRange(rows.length, scrollTop, viewportHeight, rowHeight);
  const visibleRows = rows.slice(range.start, range.end);
  const gridStyle = {
    gridTemplateColumns: `minmax(220px, 280px) repeat(${selectedProperties.length}, minmax(180px, 1fr))`,
    minWidth: `${260 + selectedProperties.length * 190}px`
  } satisfies CSSProperties;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectedProperties(table.selectedProperties);
    setOpenProperty((current) => current && table.availableProperties.includes(current) ? current : null);
    setSort((current) => current.property !== null && !table.availableProperties.includes(current.property)
      ? { direction: "asc", property: null }
      : current);
  }, [table.availableProperties, table.selectedProperties]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setColumnReferenceProperty(null);
      }
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setColumnReferenceProperty(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  const toggleProperty = async (property: string): Promise<void> => {
    if (saving) return;
    const previous = selectedProperties;
    const next = previous.includes(property)
      ? previous.filter((item) => item !== property)
      : [...previous, property].sort((left, right) => left.localeCompare(right, "ja", { numeric: true, sensitivity: "base" }));
    setSelectedProperties(next);
    setSaving(true);
    setSaveError(null);
    try {
      const result = await relicClient.current?.saveWorkspaceTableProperties(next);
      if (!result?.ok) {
        setSelectedProperties(previous);
        setSaveError(result?.error.message ?? t("table.saveFailed"));
      } else {
        setSelectedProperties(result.value);
        resetWorkspaceTableCache();
      }
    } catch {
      setSelectedProperties(previous);
      setSaveError(t("table.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleColumnMenu = (): void => {
    if (menuOpen) setColumnReferenceProperty(null);
    setMenuOpen(!menuOpen);
  };

  return (
    <section aria-label={t("table.title")} className="table-view">
      <header className="table-view-toolbar">
        <span>{t("table.fileCount", { count: table.rows.length })}</span>
        <div className="table-column-menu" ref={menuRef}>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            className="table-column-menu-trigger"
            onClick={toggleColumnMenu}
            type="button"
          >
            {t("table.columns")}
          </button>
          {menuOpen ? (
            <div aria-label={t("table.columns")} className="table-column-popover" role="dialog">
              {columnReferenceProperty ? (
                <>
                  <button
                    className="table-column-reference-back"
                    onClick={() => setColumnReferenceProperty(null)}
                    type="button"
                  >
                    ← {t("table.backToColumns")}
                  </button>
                  <TablePropertyPopover
                    categoryChoices={categoryChoices}
                    onCategoryChoicesSave={onCategoryChoicesSave}
                    property={columnReferenceProperty}
                  />
                </>
              ) : (
                <>
                  {table.availableProperties.length > 0 ? (
                    <>
                      <input
                        aria-label={t("table.searchProperties")}
                        onChange={(event) => setPropertySearch(event.target.value)}
                        placeholder={t("table.searchProperties")}
                        type="search"
                        value={propertySearch}
                      />
                      <div className="table-column-options">
                        {filteredProperties.map((property) => (
                          <label className="table-column-option" key={property}>
                            <input
                              checked={selectedProperties.includes(property)}
                              disabled={saving}
                              onChange={() => void toggleProperty(property)}
                              type="checkbox"
                            />
                            <span>{property}</span>
                          </label>
                        ))}
                        {filteredProperties.length === 0 ? <p>{t("table.noMatchingProperties")}</p> : null}
                      </div>
                    </>
                  ) : <p>{t("table.noProperties")}</p>}
                  <TableFixedPropertyReferenceList onSelect={setColumnReferenceProperty} />
                </>
              )}
            </div>
          ) : null}
        </div>
        {saveError ? <span className="table-view-save-error" role="alert">{saveError}</span> : null}
      </header>
      <div
        aria-colcount={selectedProperties.length + 1}
        aria-rowcount={rows.length + 1}
        className="table-view-scroll"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={scrollRef}
        role="table"
      >
        <div className="table-view-header" role="row" style={gridStyle}>
          <SortableHeader
            active={sort.property === null}
            direction={sort.direction}
            label={t("table.fileName")}
            onClick={() => setSort((current) => nextTableSort(current, null))}
            sticky
          />
          {selectedProperties.map((property) => (
            <SortableHeader
              active={sort.property === property}
              direction={sort.direction}
              key={property}
              label={property}
              onClick={() => setSort((current) => nextTableSort(current, property))}
              onPropertySettings={FIXED_FIELDS.some((field) => field.name === property)
                ? () => setOpenProperty((current) => current === property ? null : property)
                : undefined}
              propertySettings={openProperty === property ? (
                <TablePropertyPopover
                  categoryChoices={categoryChoices}
                  onCategoryChoicesSave={onCategoryChoicesSave}
                  property={property}
                />
              ) : null}
              propertySettingsOpen={openProperty === property}
              setPropertySettingsOpen={(open) => setOpenProperty(open ? property : null)}
            />
          ))}
        </div>
        <div className="table-view-rows" role="rowgroup" style={{ height: rows.length * rowHeight, minWidth: gridStyle.minWidth }}>
          {visibleRows.map((row, visibleIndex) => (
            <TableRow
              duplicateName={duplicateNames.has(row.name)}
              key={row.path}
              onOpenFile={onOpenFile}
              row={row}
              rowIndex={range.start + visibleIndex}
              selectedProperties={selectedProperties}
              style={gridStyle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SortableHeader({
  active,
  direction,
  label,
  onClick,
  onPropertySettings,
  propertySettings,
  propertySettingsOpen = false,
  setPropertySettingsOpen,
  sticky = false
}: {
  active: boolean;
  direction: "asc" | "desc";
  label: string;
  onClick: () => void;
  onPropertySettings?: () => void;
  propertySettings?: ReactElement | null;
  propertySettingsOpen?: boolean;
  setPropertySettingsOpen?: (open: boolean) => void;
  sticky?: boolean;
}): ReactElement {
  const t = useT();
  const propertyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!propertySettingsOpen) return;
    const close = (event: PointerEvent): void => {
      if (!propertyMenuRef.current?.contains(event.target as Node)) setPropertySettingsOpen?.(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setPropertySettingsOpen?.(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [propertySettingsOpen, setPropertySettingsOpen]);

  return (
    <div
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={sticky ? "table-view-cell table-view-cell--sticky" : "table-view-cell"}
      ref={propertyMenuRef}
      role="columnheader"
    >
      <button className="table-sort-button" aria-label={t("table.sortBy", { name: label })} onClick={onClick} type="button">
        <span>{label}</span>
        <span aria-hidden="true" className="table-sort-indicator">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
      {onPropertySettings ? (
        <button
          aria-expanded={propertySettingsOpen}
          aria-label={t("table.propertySettings", { name: label })}
          className="table-property-settings-trigger"
          onClick={onPropertySettings}
          type="button"
        >
          <span aria-hidden="true">⋮</span>
        </button>
      ) : null}
      {propertySettingsOpen && propertySettings ? (
        <div
          aria-label={t("table.propertySettings", { name: label })}
          className="table-property-popover"
          role="dialog"
        >
          {propertySettings}
        </div>
      ) : null}
    </div>
  );
}

function TableRow({ duplicateName, onOpenFile, row, rowIndex, selectedProperties, style }: {
  duplicateName: boolean;
  onOpenFile: (path: string) => void;
  row: WorkspaceTableRow;
  rowIndex: number;
  selectedProperties: string[];
  style: CSSProperties;
}): ReactElement {
  const t = useT();
  return (
    <div
      aria-rowindex={rowIndex + 2}
      className="table-view-row"
      role="row"
      style={{ ...style, height: rowHeight, transform: `translateY(${rowIndex * rowHeight}px)` }}
    >
      <div className="table-view-cell table-view-cell--file table-view-cell--sticky" role="cell">
        <button className="table-file-link" onClick={() => onOpenFile(row.path)} type="button">
          <span className="table-file-name">{row.name}</span>
          {duplicateName ? <span className="table-file-directory">{directoryForPath(row.path)}</span> : null}
        </button>
        {row.frontmatterStatus === "invalid" ? (
          <span
            aria-label={t("table.invalidFrontmatter")}
            className="table-frontmatter-warning table-value-tooltip"
            data-full-value={t("table.invalidFrontmatter")}
            tabIndex={0}
          >!
          </span>
        ) : null}
      </div>
      {selectedProperties.map((property) => (
        <ValueCell key={property} value={row.properties[property]} />
      ))}
    </div>
  );
}

function ValueCell({ value }: { value?: WorkspaceTableValue }): ReactElement {
  if (!value) return <div aria-label="" className="table-view-cell table-view-cell--empty" role="cell" />;
  return (
    <div className="table-view-cell" role="cell">
      <span
        aria-label={value.text}
        className={`table-value table-value--${value.kind} table-value-tooltip`}
        data-full-value={value.text}
        tabIndex={0}
        title={value.text}
      >
        {value.kind === "boolean" ? <span aria-hidden="true">{value.booleanValue ? "☑" : "☐"} </span> : null}
        {value.text}
      </span>
    </div>
  );
}
