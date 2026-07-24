import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactElement
} from "react";

import {
  workspaceTablePreferenceLimits,
  type FrontmatterCategoryChoice,
  type WorkspaceTable,
  type WorkspaceTableRow,
  type WorkspaceTableValue
} from "../../shared/ipc";
import { FIXED_FIELDS } from "../frontmatterSettingsModel";
import { useDismissablePopover } from "../hooks/useDismissablePopover";
import { useT } from "../i18n";
import {
  compactTableRowHeight,
  directoryForPath,
  duplicateFileNames,
  filterTableRows,
  nextTableSort,
  reorderTableProperties,
  sortTableRows,
  tableColumnDragOffsets,
  tableColumnWidth,
  visibleTableRange,
  withFileColumnWidth,
  withTableColumnWidth,
  wrappedTableRowHeight,
  type TableColumnDropEdge
} from "../table/tableViewModel";
import { resetWorkspaceTableCache } from "../table/workspaceTableLoader";
import { useWorkspaceTablePreferences } from "../table/useWorkspaceTablePreferences";
import { useWorkspaceTableState } from "../table/useWorkspaceTableState";
import { TableColumnHeader } from "./TableColumnHeader";
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
  const [search, setSearch] = useState("");
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
  const {
    persist,
    preferences,
    retry,
    saveError,
    setPreferences
  } = useWorkspaceTablePreferences({
    initialPreferences: table.preferences,
    saveFailedMessage: t("table.saveFailed")
  });

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
  const columnDragOffsets = draggedProperty && columnDropTarget
    ? tableColumnDragOffsets(
      selectedProperties,
      Object.fromEntries(selectedProperties.map((property, index) => [property, widths[index] ?? 0])),
      draggedProperty,
      columnDropTarget.property,
      columnDropTarget.edge
    )
    : {};
  const gridStyle = {
    gridTemplateColumns: `${preferences.fileColumnWidth}px ${widths.map((width) => `${width}px`).join(" ")}`.trim(),
    minWidth: `${preferences.fileColumnWidth + widths.reduce((sum, width) => sum + width, 0)}px`
  } satisfies CSSProperties;

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
    if (next !== selectedProperties) {
      void persist({ ...preferences, selectedProperties: next }, preferences);
    }
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
        </div>
        <span className="table-result-count">
          {search.trim().length > 0 || preferences.filters.length > 0
            ? t("table.resultCountFiltered", { total: table.rows.length, visible: rows.length })
            : t("table.resultCountAll", { total: table.rows.length })}
        </span>
        {saveError ? (
          <span className="table-view-save-error" role="alert">
            {saveError} <button onClick={() => void retry()} type="button">{t("common.retry")}</button>
          </span>
        ) : null}
      </header>
      <div
        aria-colcount={selectedProperties.length + 1}
        aria-rowcount={rows.length + 1}
        className={`table-view-scroll${scrollTop > 0 ? " table-view-scroll--scrolled" : ""}`}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={scrollRef}
        role="table"
      >
        <div className="table-view-header" role="row" style={gridStyle}>
          <TableColumnHeader
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
              <TableColumnHeader
                active={preferences.sort.property === property}
                direction={preferences.sort.direction}
                dragState={draggedProperty === property
                  ? "dragging"
                  : columnDropTarget?.property === property
                    ? `drop-${columnDropTarget.edge}`
                    : undefined}
                dragOffset={columnDragOffsets[property]}
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
              columnDragOffsets={columnDragOffsets}
              draggedProperty={draggedProperty}
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

function TableRow({ columnDragOffsets, draggedProperty, duplicateName, onOpenFile, row, rowHeight, rowIndex, selectedProperties, style, wrappedProperties }: {
  columnDragOffsets: Readonly<Record<string, number>>;
  draggedProperty: string | null;
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
        <ValueCell
          dragOffset={columnDragOffsets[property] ?? 0}
          dragging={draggedProperty === property}
          key={property}
          value={row.properties[property]}
          wrapped={wrappedProperties.includes(property)}
        />
      ))}
    </div>
  );
}

function ValueCell({ dragOffset, dragging, value, wrapped }: {
  dragOffset: number;
  dragging: boolean;
  value?: WorkspaceTableValue;
  wrapped: boolean;
}): ReactElement {
  const style = { "--table-column-drag-offset": `${dragOffset}px` } as CSSProperties;
  const className = `table-view-cell${dragging ? " table-view-cell--dragging" : ""}`;
  if (!value) return <div aria-label="" className={`${className} table-view-cell--empty`} role="cell" style={style} />;
  return (
    <div className={className} role="cell" style={style}>
      <span aria-label={value.text} className={`table-value table-value--${value.kind}${wrapped ? " table-value--wrapped" : ""}`}>
        {value.kind === "boolean" ? <span aria-hidden="true">{value.booleanValue ? "☑" : "☐"} </span> : null}
        {value.text}
      </span>
    </div>
  );
}
