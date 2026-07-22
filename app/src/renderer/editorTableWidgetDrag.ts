import {
  liveTableAxisIndexFromPoint,
  measureLiveTableAxisSegment
} from "./editorTableWidgetGeometry";

export type LiveTableDragAxis = "column" | "row";

interface LiveTableDragMove {
  axis: LiveTableDragAxis;
  sourceCol: number;
  sourceRow: number;
  targetCol: number;
  targetRow: number;
}

export interface LiveTableDragController {
  beginCoordinateDrag: (axis: LiveTableDragAxis, event: MouseEvent | PointerEvent) => void;
  moveDraggedSelection: (targetRow: number, targetCol: number) => void;
}

export function createLiveTableDragController({
  colCount,
  getActiveCol,
  getActiveRow,
  onMove,
  rowCount,
  table,
  wrapper
}: {
  colCount: number;
  getActiveCol: () => number;
  getActiveRow: () => number;
  onMove: (move: LiveTableDragMove) => void;
  rowCount: number;
  table: HTMLTableElement;
  wrapper: HTMLElement;
}): LiveTableDragController {
  const setDropTarget = (targetRow: number, targetCol: number): void => {
    const axis = wrapper.dataset.dragAxis;
    if (!axis) return;
    wrapper.dataset.dragTargetRow = String(targetRow);
    wrapper.dataset.dragTargetCol = String(targetCol);
    const colSegment = measureLiveTableAxisSegment(wrapper, table, "column", targetCol);
    const rowSegment = measureLiveTableAxisSegment(wrapper, table, "row", targetRow);
    wrapper.style.setProperty(
      "--table-drop-col",
      colSegment ? `${colSegment.start}px` : `${(targetCol / colCount) * 100}%`
    );
    wrapper.style.setProperty(
      "--table-drop-row",
      rowSegment ? `${rowSegment.start}px` : `${(targetRow / rowCount) * 100}%`
    );
  };

  const cellFromPoint = (clientX: number, clientY: number): HTMLElement | null => {
    const element = typeof document.elementFromPoint === "function"
      ? document.elementFromPoint(clientX, clientY)
      : null;
    const cell = element instanceof HTMLElement ? element.closest("[data-row][data-column]") : null;
    return cell instanceof HTMLElement && wrapper.contains(cell) ? cell : null;
  };

  const targetFromCell = (cell: HTMLElement): { row: number; col: number } => ({
    row: Number(cell.dataset.row ?? 0),
    col: Number(cell.dataset.column ?? 0)
  });

  const targetFromPoint = (clientX: number, clientY: number): { row: number; col: number } | null => {
    const cell = cellFromPoint(clientX, clientY);
    if (cell) return targetFromCell(cell);

    const rect = table.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const col = liveTableAxisIndexFromPoint(table, "column", clientX)
      ?? Math.max(0, Math.min(colCount - 1, Math.floor(((clientX - rect.left) / rect.width) * colCount)));
    const row = liveTableAxisIndexFromPoint(table, "row", clientY, 1)
      ?? Math.max(1, Math.min(rowCount - 1, Math.floor(((clientY - rect.top) / rect.height) * rowCount)));
    return { row, col };
  };

  const targetFromEvent = (event: MouseEvent | PointerEvent): { row: number; col: number } | null => {
    const cell = event.target instanceof HTMLElement ? event.target.closest("[data-row][data-column]") : null;
    if (cell instanceof HTMLElement && wrapper.contains(cell)) return targetFromCell(cell);
    return targetFromPoint(event.clientX, event.clientY);
  };

  const moveDraggedSelection = (targetRow: number, targetCol: number): void => {
    const axis = wrapper.dataset.dragAxis as LiveTableDragAxis | undefined;
    const sourceRow = Number(wrapper.dataset.dragSourceRow ?? getActiveRow());
    const sourceCol = Number(wrapper.dataset.dragSourceCol ?? getActiveCol());
    if (!axis) return;

    onMove({ axis, sourceCol, sourceRow, targetCol, targetRow });
  };

  const beginCoordinateDrag = (
    axis: LiveTableDragAxis,
    event: MouseEvent | PointerEvent
  ): void => {
    if (wrapper.dataset.dragAxis) return;
    event.preventDefault();
    event.stopPropagation();
    const sourceRow = getActiveRow();
    const sourceCol = getActiveCol();
    wrapper.dataset.dragAxis = axis;
    wrapper.dataset.dragSourceRow = String(sourceRow);
    wrapper.dataset.dragSourceCol = String(sourceCol);
    setDropTarget(sourceRow, sourceCol);
    const firstTarget = targetFromPoint(event.clientX, event.clientY);
    if (firstTarget) setDropTarget(firstTarget.row, firstTarget.col);

    const pointerId = "pointerId" in event ? event.pointerId : null;
    const captureTarget = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null;
    if (captureTarget?.setPointerCapture && pointerId !== null) {
      try {
        captureTarget.setPointerCapture(pointerId);
      } catch {
        // Pointer capture is an optimization. Document listeners remain the fallback.
      }
    }

    const move = (moveEvent: MouseEvent | PointerEvent): void => {
      if (pointerId !== null && "pointerId" in moveEvent && moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const target = targetFromEvent(moveEvent);
      if (target) {
        setDropTarget(target.row, target.col);
      }
    };

    const cleanup = (): void => {
      delete wrapper.dataset.dragAxis;
      delete wrapper.dataset.dragSourceRow;
      delete wrapper.dataset.dragSourceCol;
      delete wrapper.dataset.dragTargetRow;
      delete wrapper.dataset.dragTargetCol;
      wrapper.style.removeProperty("--table-drop-col");
      wrapper.style.removeProperty("--table-drop-row");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      captureTarget?.removeEventListener("lostpointercapture", lostCapture);
    };
    const up = (upEvent: MouseEvent | PointerEvent): void => {
      if (pointerId !== null && "pointerId" in upEvent && upEvent.pointerId !== pointerId) return;
      upEvent.preventDefault();
      const target = targetFromEvent(upEvent);
      if (target) moveDraggedSelection(target.row, target.col);
      cleanup();
    };
    const cancel = (cancelEvent: PointerEvent): void => {
      if (pointerId !== null && cancelEvent.pointerId !== pointerId) return;
      cancelEvent.preventDefault();
      cleanup();
    };
    const lostCapture = (): void => {
      cleanup();
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    captureTarget?.addEventListener("lostpointercapture", lostCapture);
  };

  return {
    beginCoordinateDrag,
    moveDraggedSelection
  };
}
