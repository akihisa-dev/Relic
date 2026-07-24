import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from "react";

import { useDismissablePopover } from "../hooks/useDismissablePopover";
import { useT } from "../i18n";

export function TableColumnHeader({
  active,
  direction,
  dragOffset = 0,
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
  dragOffset?: number;
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
      style={{ "--table-column-drag-offset": `${dragOffset}px` } as CSSProperties}
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
