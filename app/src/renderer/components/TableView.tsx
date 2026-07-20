import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactElement
} from "react";

import {
  workspaceTablePreferenceLimits,
  type FrontmatterCategoryChoice,
  type WorkspaceTable,
  type WorkspaceTablePreferences,
  type WorkspaceTableRow,
  type WorkspaceTableValue
} from "../../shared/ipc";
import { FIXED_FIELDS } from "../frontmatterSettingsModel";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";
import {
  compactTableRowHeight,
  directoryForPath,
  duplicateFileNames,
  filterTableRows,
  nextTableSort,
  reorderTableProperties,
  sortTableRows,
  tableColumnWidth,
  visibleTableRange,
  withFileColumnWidth,
  withTableColumnWidth,
  wrappedTableRowHeight,
  type TableColumnDropEdge
} from "../table/tableViewModel";
import { resetWorkspaceTableCache } from "../table/workspaceTableLoader";
import { useWorkspaceTableState } from "../table/useWorkspaceTableState";
import { TableFilterPopover } from "./TableFilterPopover";
import { TablePropertyPopover } from "./TablePropertyPopover";

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
  const state = useWorkspaceTableState({
    loadFailedMessage: t("table.loadFailed"),
    refreshRevision: refreshRevision * 1000 + retryRevision,
    workspaceId
  });

  if (state.status === "loading") return <div className="table-view-status">{t("common.loading")}</div>;
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
      table={state.table}
    />
  );
}

function ReadyTable({ categoryChoices, onCategoryChoicesSave, onOpenFile, table }: {
  categoryChoices: FrontmatterCategoryChoice[];
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
  onOpenFile: (path: string) => void;
  table: WorkspaceTable;
}): ReactElement {
  const t = useT();
  const [preferences, setPreferences] = useState(table.preferences);
  const [search, setSearch] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draggedProperty, setDraggedProperty] = useState<string | null>(null);
  const [columnDropTarget, setColumnDropTarget] = useState<{ edge: TableColumnDropEdge; property: string } | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [openProperty, setOpenProperty] = useState<string | null>(null);
  const [propertySearch, setPropertySearch] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const columnMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const filterMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const saveRevisionRef = useRef(0);

  const selectedProperties = preferences.selectedProperties;
  const filteredRows = useMemo(
    () => filterTableRows(table.rows, search, preferences.filters, selectedProperties),
    [preferences.filters, search, selectedProperties, table.rows]
  );
  const rows = useMemo(() => sortTableRows(filteredRows, preferences.sort), [filteredRows, preferences.sort]);
  const duplicateNames = useMemo(() => duplicateFileNames(table.rows), [table.rows]);
  const filteredProperties = useMemo(() => table.availableProperties.filter((property) => (
    property.toLocaleLowerCase().includes(propertySearch.trim().toLocaleLowerCase())
  )), [propertySearch, table.availableProperties]);
  const rowHeight = preferences.wrappedProperties.some((property) => selectedProperties.includes(property))
    ? wrappedTableRowHeight
    : compactTableRowHeight;
  const range = visibleTableRange(rows.length, scrollTop, viewportHeight, rowHeight);
  const visibleRows = rows.slice(range.start, range.end);
  const widths = selectedProperties.map((property) => tableColumnWidth(preferences, property));
  const gridStyle = {
    gridTemplateColumns: `${preferences.fileColumnWidth}px ${widths.map((width) => `${width}px`).join(" ")}`.trim(),
    minWidth: `${preferences.fileColumnWidth + widths.reduce((sum, width) => sum + width, 0)}px`
  } satisfies CSSProperties;

  useEffect(() => setPreferences(table.preferences), [table.preferences]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useDismissablePopover(columnMenuOpen, columnMenuRef, (restoreFocus) => {
    setColumnMenuOpen(false);
    if (restoreFocus) columnMenuTriggerRef.current?.focus();
  });
  useDismissablePopover(filterMenuOpen, filterMenuRef, (restoreFocus) => {
    setFilterMenuOpen(false);
    if (restoreFocus) filterMenuTriggerRef.current?.focus();
  });

  useEffect(() => {
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [preferences.filters, search]);

  const persist = async (next: WorkspaceTablePreferences): Promise<void> => {
    const revision = ++saveRevisionRef.current;
    setPreferences(next);
    setSaveError(null);
    try {
      const result = await relicClient.current?.saveWorkspaceTablePreferences(next);
      if (revision !== saveRevisionRef.current) return;
      if (!result?.ok) {
        setSaveError(result?.error.message ?? t("table.saveFailed"));
        return;
      }
      setPreferences(result.value);
      resetWorkspaceTableCache();
    } catch {
      if (revision === saveRevisionRef.current) setSaveError(t("table.saveFailed"));
    }
  };

  const toggleProperty = (property: string): void => {
    const selected = selectedProperties.includes(property);
    const nextSelected = selected
      ? selectedProperties.filter((item) => item !== property)
      : [...selectedProperties, property];
    void persist({
      ...preferences,
      columnWidths: selected ? preferences.columnWidths.filter((entry) => entry.property !== property) : preferences.columnWidths,
      selectedProperties: nextSelected,
      sort: preferences.sort.property === property && selected ? { direction: "asc", property: null } : preferences.sort,
      wrappedProperties: selected ? preferences.wrappedProperties.filter((item) => item !== property) : preferences.wrappedProperties
    });
  };

  const changeSort = (property: string | null): void => {
    void persist({ ...preferences, sort: nextTableSort(preferences.sort, property) });
  };

  const moveProperty = (property: string, offset: -1 | 1): void => {
    const index = selectedProperties.indexOf(property);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= selectedProperties.length) return;
    const next = [...selectedProperties];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    void persist({ ...preferences, selectedProperties: next });
  };

  const updatePropertyWidth = (property: string, width: number, save: boolean): void => {
    const next = withTableColumnWidth(preferences, property, width);
    if (save) void persist(next);
    else setPreferences(next);
  };

  const updateFileWidth = (width: number, save: boolean): void => {
    const next = withFileColumnWidth(preferences, width);
    if (save) void persist(next);
    else setPreferences(next);
  };

  const startColumnDrag = (property: string, event: DragEvent<HTMLButtonElement>): void => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", property);
    setOpenProperty(null);
    setDraggedProperty(property);
    setColumnDropTarget(null);
  };

  const dragColumnOver = (property: string, event: DragEvent<HTMLDivElement>): void => {
    if (!draggedProperty || draggedProperty === property) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    setColumnDropTarget({ edge: event.clientX < bounds.left + bounds.width / 2 ? "before" : "after", property });
  };

  const finishColumnDrag = (): void => {
    setDraggedProperty(null);
    setColumnDropTarget(null);
  };

  const dropColumn = (property: string, event: DragEvent<HTMLDivElement>): void => {
    if (!draggedProperty || draggedProperty === property) return;
    event.preventDefault();
    const edge = columnDropTarget?.property === property ? columnDropTarget.edge : "before";
    const next = reorderTableProperties(selectedProperties, draggedProperty, property, edge);
    finishColumnDrag();
    if (next !== selectedProperties) void persist({ ...preferences, selectedProperties: next });
  };

  return (
    <section aria-label={t("table.title")} className="table-view">
      <header className="table-view-toolbar">
        <input
          aria-label={t("table.search")}
          className="table-search-input"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && search) {
              event.preventDefault();
              setSearch("");
            }
          }}
          placeholder={t("table.searchPlaceholder")}
          type="search"
          value={search}
        />
        <div className="table-toolbar-actions">
          <div className="table-filter-menu" ref={filterMenuRef}>
            <button
              aria-expanded={filterMenuOpen}
              aria-haspopup="dialog"
              className="table-toolbar-button"
              onClick={() => setFilterMenuOpen((open) => !open)}
              ref={filterMenuTriggerRef}
              type="button"
            >
              {preferences.filters.length > 0 ? t("table.filtersCount", { count: preferences.filters.length }) : t("table.filters")}
            </button>
            {filterMenuOpen ? (
              <div aria-label={t("table.filters")} className="table-filter-popover" role="dialog">
                <TableFilterPopover
                  availableProperties={table.availableProperties}
                  filters={preferences.filters}
                  onChange={(filters) => void persist({ ...preferences, filters })}
                />
              </div>
            ) : null}
          </div>
          <div className="table-column-menu" ref={columnMenuRef}>
            <button
              aria-expanded={columnMenuOpen}
              aria-haspopup="dialog"
              className="table-toolbar-button"
              onClick={() => setColumnMenuOpen((open) => !open)}
              ref={columnMenuTriggerRef}
              type="button"
            >{t("table.columns")}</button>
            {columnMenuOpen ? (
              <div aria-label={t("table.columns")} className="table-column-popover" role="dialog">
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
                          <input checked={selectedProperties.includes(property)} onChange={() => toggleProperty(property)} type="checkbox" />
                          <span>{property}</span>
                        </label>
                      ))}
                      {filteredProperties.length === 0 ? <p>{t("table.noMatchingProperties")}</p> : null}
                    </div>
                  </>
                ) : <p>{t("table.noProperties")}</p>}
              </div>
            ) : null}
          </div>
          <span className="table-result-count">{t("table.resultCount", { total: table.rows.length, visible: rows.length })}</span>
        </div>
        {saveError ? (
          <span className="table-view-save-error" role="alert">
            {saveError} <button onClick={() => void persist(preferences)} type="button">{t("common.retry")}</button>
          </span>
        ) : null}
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
          <TableHeader
            active={preferences.sort.property === null}
            direction={preferences.sort.direction}
            label={t("table.fileName")}
            onResizeCancel={(width) => updateFileWidth(width, false)}
            onResizeCommit={(width) => updateFileWidth(width, true)}
            onResizePreview={(width) => updateFileWidth(width, false)}
            onSort={() => changeSort(null)}
            resizeMaximum={workspaceTablePreferenceLimits.fileColumnMaximum}
            resizeMinimum={workspaceTablePreferenceLimits.fileColumnMinimum}
            sticky
            width={preferences.fileColumnWidth}
          />
          {selectedProperties.map((property, index) => {
            const width = tableColumnWidth(preferences, property);
            const wrapped = preferences.wrappedProperties.includes(property);
            return (
              <TableHeader
                active={preferences.sort.property === property}
                direction={preferences.sort.direction}
                dragState={draggedProperty === property
                  ? "dragging"
                  : columnDropTarget?.property === property
                    ? `drop-${columnDropTarget.edge}`
                    : undefined}
                key={property}
                label={property}
                onColumnDragEnd={finishColumnDrag}
                onColumnDragOver={(event) => dragColumnOver(property, event)}
                onColumnDragStart={(event) => startColumnDrag(property, event)}
                onColumnDrop={(event) => dropColumn(property, event)}
                onHide={() => toggleProperty(property)}
                onMoveLeft={() => moveProperty(property, -1)}
                onMoveRight={() => moveProperty(property, 1)}
                onPropertySettings={FIXED_FIELDS.some((field) => field.name === property)
                  ? () => setOpenProperty((current) => current === property ? null : property)
                  : undefined}
                onResetWidth={() => updatePropertyWidth(property, workspaceTablePreferenceLimits.propertyColumnDefault, true)}
                onResizeCancel={(nextWidth) => updatePropertyWidth(property, nextWidth, false)}
                onResizeCommit={(nextWidth) => updatePropertyWidth(property, nextWidth, true)}
                onResizePreview={(nextWidth) => updatePropertyWidth(property, nextWidth, false)}
                onSort={() => changeSort(property)}
                onToggleWrap={() => void persist({
                  ...preferences,
                  wrappedProperties: wrapped
                    ? preferences.wrappedProperties.filter((item) => item !== property)
                    : [...preferences.wrappedProperties, property]
                })}
                propertySettings={openProperty === property ? (
                  <TablePropertyPopover
                    categoryChoices={categoryChoices}
                    onCategoryChoicesSave={onCategoryChoicesSave}
                    property={property}
                  />
                ) : null}
                propertySettingsOpen={openProperty === property}
                resizeMaximum={workspaceTablePreferenceLimits.propertyColumnMaximum}
                resizeMinimum={workspaceTablePreferenceLimits.propertyColumnMinimum}
                setPropertySettingsOpen={(open) => setOpenProperty(open ? property : null)}
                width={width}
                wrapped={wrapped}
                first={index === 0}
                last={index === selectedProperties.length - 1}
              />
            );
          })}
        </div>
        <div className="table-view-rows" role="rowgroup" style={{ height: rows.length * rowHeight, minWidth: gridStyle.minWidth }}>
          {rows.length === 0 ? <div className="table-view-no-results">{t("table.noMatchingRows")}</div> : null}
          {visibleRows.map((row, visibleIndex) => (
            <TableRow
              duplicateName={duplicateNames.has(row.name)}
              key={row.path}
              onOpenFile={onOpenFile}
              row={row}
              rowHeight={rowHeight}
              rowIndex={range.start + visibleIndex}
              selectedProperties={selectedProperties}
              style={gridStyle}
              wrappedProperties={preferences.wrappedProperties}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TableHeader({
  active,
  direction,
  dragState,
  first = false,
  label,
  last = false,
  onColumnDragEnd,
  onColumnDragOver,
  onColumnDragStart,
  onColumnDrop,
  onHide,
  onMoveLeft,
  onMoveRight,
  onPropertySettings,
  onResetWidth,
  onResizeCancel,
  onResizeCommit,
  onResizePreview,
  onSort,
  onToggleWrap,
  propertySettings,
  propertySettingsOpen = false,
  resizeMaximum,
  resizeMinimum,
  setPropertySettingsOpen,
  sticky = false,
  width,
  wrapped = false
}: {
  active: boolean;
  direction: "asc" | "desc";
  dragState?: "dragging" | "drop-after" | "drop-before";
  first?: boolean;
  label: string;
  last?: boolean;
  onColumnDragEnd?: () => void;
  onColumnDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onColumnDragStart?: (event: DragEvent<HTMLButtonElement>) => void;
  onColumnDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onHide?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  onPropertySettings?: () => void;
  onResetWidth?: () => void;
  onResizeCancel: (width: number) => void;
  onResizeCommit: (width: number) => void;
  onResizePreview: (width: number) => void;
  onSort: () => void;
  onToggleWrap?: () => void;
  propertySettings?: ReactElement | null;
  propertySettingsOpen?: boolean;
  resizeMaximum: number;
  resizeMinimum: number;
  setPropertySettingsOpen?: (open: boolean) => void;
  sticky?: boolean;
  width: number;
  wrapped?: boolean;
}): ReactElement {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement>(null);
  const propertyTriggerRef = useRef<HTMLButtonElement>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  useDismissablePopover(actionsOpen || propertySettingsOpen, rootRef, (restoreFocus) => {
    const restoreTarget = actionsOpen ? actionsTriggerRef.current : propertyTriggerRef.current;
    setActionsOpen(false);
    setPropertySettingsOpen?.(false);
    if (restoreFocus) restoreTarget?.focus();
  });

  return (
    <div
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={["table-view-cell", sticky ? "table-view-cell--sticky" : "", dragState ? `table-view-cell--${dragState}` : ""].filter(Boolean).join(" ")}
      onDragOver={onColumnDragOver}
      onDrop={onColumnDrop}
      ref={rootRef}
      role="columnheader"
    >
      {onColumnDragStart ? (
        <button
          aria-label={t("table.reorderColumn", { name: label })}
          className="table-column-drag-handle"
          draggable
          onDragEnd={onColumnDragEnd}
          onDragStart={onColumnDragStart}
          type="button"
        ><span aria-hidden="true">⋮⋮</span></button>
      ) : null}
      <button aria-label={t("table.sortBy", { name: label })} className="table-sort-button" onClick={onSort} type="button">
        <span>{label}</span>
        <span aria-hidden="true" className="table-sort-indicator">{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
      {onHide ? (
        <button
          aria-expanded={actionsOpen}
          aria-label={t("table.columnActions", { name: label })}
          className="table-column-actions-trigger"
          onClick={() => {
            setPropertySettingsOpen?.(false);
            setActionsOpen((open) => !open);
          }}
          ref={actionsTriggerRef}
          type="button"
        ><span aria-hidden="true">•••</span></button>
      ) : null}
      {onPropertySettings ? (
        <button
          aria-expanded={propertySettingsOpen}
          aria-label={t("table.propertySettings", { name: label })}
          className="table-property-settings-trigger"
          onClick={() => {
            setActionsOpen(false);
            onPropertySettings();
          }}
          ref={propertyTriggerRef}
          type="button"
        ><span aria-hidden="true">⋮</span></button>
      ) : null}
      {actionsOpen ? (
        <div aria-label={t("table.columnActions", { name: label })} className="table-column-actions" role="menu">
          <button disabled={first} onClick={onMoveLeft} role="menuitem" type="button">{t("table.moveColumnLeft")}</button>
          <button disabled={last} onClick={onMoveRight} role="menuitem" type="button">{t("table.moveColumnRight")}</button>
          <button onClick={() => onResizeCommit(width - 48)} role="menuitem" type="button">{t("table.narrowColumn")}</button>
          <button onClick={() => onResizeCommit(width + 48)} role="menuitem" type="button">{t("table.widenColumn")}</button>
          <button onClick={onResetWidth} role="menuitem" type="button">{t("table.resetColumnWidth")}</button>
          <button onClick={onToggleWrap} role="menuitem" type="button">{wrapped ? t("table.disableWrap") : t("table.enableWrap")}</button>
          <button onClick={onHide} role="menuitem" type="button">{t("table.hideColumn")}</button>
        </div>
      ) : null}
      {propertySettingsOpen && propertySettings ? (
        <div aria-label={t("table.propertySettings", { name: label })} className="table-property-popover" role="dialog">{propertySettings}</div>
      ) : null}
      <ColumnResizeHandle
        label={label}
        maximum={resizeMaximum}
        minimum={resizeMinimum}
        onCancel={onResizeCancel}
        onCommit={onResizeCommit}
        onPreview={onResizePreview}
        width={width}
      />
    </div>
  );
}

function ColumnResizeHandle({ label, maximum, minimum, onCancel, onCommit, onPreview, width }: {
  label: string;
  maximum: number;
  minimum: number;
  onCancel: (width: number) => void;
  onCommit: (width: number) => void;
  onPreview: (width: number) => void;
  width: number;
}): ReactElement {
  const t = useT();
  const dragRef = useRef<{ active: boolean; pointerId: number; startWidth: number; startX: number }>({ active: false, pointerId: -1, startWidth: width, startX: 0 });

  const cancel = (): void => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    onCancel(drag.startWidth);
  };

  return (
    <button
      aria-label={t("table.resizeColumn", { name: label })}
      aria-orientation="vertical"
      aria-valuemax={maximum}
      aria-valuemin={minimum}
      aria-valuenow={width}
      className="table-column-resize-handle"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const amount = event.shiftKey ? 48 : 16;
        onCommit(width + (event.key === "ArrowRight" ? amount : -amount));
      }}
      onLostPointerCapture={cancel}
      onPointerCancel={cancel}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        dragRef.current = { active: true, pointerId: event.pointerId, startWidth: width, startX: event.clientX };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) return;
        onPreview(drag.startWidth + event.clientX - drag.startX);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        if (!drag.active || drag.pointerId !== event.pointerId) return;
        drag.active = false;
        onCommit(drag.startWidth + event.clientX - drag.startX);
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
      role="separator"
      type="button"
    />
  );
}

function TableRow({ duplicateName, onOpenFile, row, rowHeight, rowIndex, selectedProperties, style, wrappedProperties }: {
  duplicateName: boolean;
  onOpenFile: (path: string) => void;
  row: WorkspaceTableRow;
  rowHeight: number;
  rowIndex: number;
  selectedProperties: string[];
  style: CSSProperties;
  wrappedProperties: string[];
}): ReactElement {
  const t = useT();
  return (
    <div aria-rowindex={rowIndex + 2} className="table-view-row" role="row" style={{ ...style, height: rowHeight, transform: `translateY(${rowIndex * rowHeight}px)` }}>
      <div className="table-view-cell table-view-cell--file table-view-cell--sticky" role="cell">
        <button className="table-file-link" onClick={() => onOpenFile(row.path)} type="button">
          <span className="table-file-name">{row.name}</span>
          {duplicateName ? <span className="table-file-directory">{directoryForPath(row.path)}</span> : null}
        </button>
        {row.frontmatterStatus === "invalid" ? <span aria-label={t("table.invalidFrontmatter")} className="table-frontmatter-warning">!</span> : null}
      </div>
      {selectedProperties.map((property) => (
        <ValueCell key={property} value={row.properties[property]} wrapped={wrappedProperties.includes(property)} />
      ))}
    </div>
  );
}

function ValueCell({ value, wrapped }: { value?: WorkspaceTableValue; wrapped: boolean }): ReactElement {
  if (!value) return <div aria-label="" className="table-view-cell table-view-cell--empty" role="cell" />;
  return (
    <div className="table-view-cell" role="cell">
      <span aria-label={value.text} className={`table-value table-value--${value.kind}${wrapped ? " table-value--wrapped" : ""}`}>
        {value.kind === "boolean" ? <span aria-hidden="true">{value.booleanValue ? "☑" : "☐"} </span> : null}
        {value.text}
      </span>
    </div>
  );
}

function useDismissablePopover(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  close: (restoreFocus: boolean) => void
): void {
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent): void => {
      if (!ref.current?.contains(event.target as Node)) close(false);
    };
    const keyboard = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [close, open, ref]);
}
