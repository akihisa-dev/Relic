import { measureLiveTableAxisSegment } from "./editorTableWidgetGeometry";

export type LiveTableActiveAxis = "row" | "column" | "cell";

export interface LiveTableInteractionState {
  readonly activeCol: number;
  readonly activeRow: number;
  clearAffordance: () => void;
  clearIfFocusOutside: (relatedTarget?: EventTarget | null) => void;
  markActive: (axis: LiveTableActiveAxis, rowIndex: number, colIndex: number) => void;
  markRange: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
  positionControls: () => void;
  setAddAffordance: (rowIndex: number, colIndex: number) => void;
}

export function createLiveTableInteractionState(
  wrapper: HTMLElement,
  table: HTMLTableElement,
  rowCount: number,
  colCount: number
): LiveTableInteractionState {
  let activeRow = Math.min(1, rowCount - 1);
  let activeCol = 0;

  const positionControls = (): void => {
    const colSegment = measureLiveTableAxisSegment(wrapper, table, "column", activeCol);
    const rowSegment = measureLiveTableAxisSegment(wrapper, table, "row", activeRow);
    const colStart = colSegment ? `${colSegment.start}px` : `${(activeCol / colCount) * 100}%`;
    const colCenter = colSegment
      ? `${colSegment.start + colSegment.size / 2}px`
      : `${((activeCol + 0.5) / colCount) * 100}%`;
    const colAfter = colSegment
      ? `${colSegment.start + colSegment.size}px`
      : `${((activeCol + 1) / colCount) * 100}%`;
    const colWidth = colSegment ? `${colSegment.size}px` : `${100 / colCount}%`;
    const rowStart = rowSegment ? `${rowSegment.start}px` : `${(activeRow / rowCount) * 100}%`;
    const rowCenter = rowSegment
      ? `${rowSegment.start + rowSegment.size / 2}px`
      : `${((activeRow + 0.5) / rowCount) * 100}%`;
    const rowAfter = rowSegment
      ? `${rowSegment.start + rowSegment.size}px`
      : `${((activeRow + 1) / rowCount) * 100}%`;
    const rowHeight = rowSegment ? `${rowSegment.size}px` : `${100 / rowCount}%`;
    wrapper.style.setProperty("--table-active-col-start", colStart);
    wrapper.style.setProperty("--table-active-col-center", colCenter);
    wrapper.style.setProperty("--table-active-col-after", colAfter);
    wrapper.style.setProperty("--table-active-col-width", colWidth);
    wrapper.style.setProperty("--table-active-row-start", rowStart);
    wrapper.style.setProperty("--table-active-row-center", rowCenter);
    wrapper.style.setProperty("--table-active-row-after", rowAfter);
    wrapper.style.setProperty("--table-active-row-height", rowHeight);
  };

  const clearAffordance = (): void => {
    delete wrapper.dataset.canAddColumnBefore;
    delete wrapper.dataset.canAddColumnAfter;
    delete wrapper.dataset.canAddRowBefore;
    delete wrapper.dataset.canAddRowAfter;
    delete wrapper.dataset.canDeleteColumn;
    delete wrapper.dataset.canDeleteRow;
    delete wrapper.dataset.canGrabColumn;
    delete wrapper.dataset.canGrabRow;
  };

  const clearActive = (): void => {
    wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
      element.classList.remove("cm-live-table-active");
    });
    wrapper.querySelectorAll(".cm-live-table-selected").forEach((element) => {
      element.classList.remove("cm-live-table-selected");
    });
    delete wrapper.dataset.activeAxis;
    delete wrapper.dataset.activeRow;
    delete wrapper.dataset.activeCol;
    delete wrapper.dataset.selectedRange;
    clearAffordance();
  };

  const state: LiveTableInteractionState = {
    get activeCol() {
      return activeCol;
    },
    get activeRow() {
      return activeRow;
    },
    clearAffordance,
    clearIfFocusOutside: (relatedTarget: EventTarget | null = null): void => {
      const relatedNode = relatedTarget instanceof Node ? relatedTarget : null;

      if (relatedNode && wrapper.contains(relatedNode)) return;
      if (relatedNode && !wrapper.contains(relatedNode)) {
        clearActive();
        return;
      }

      requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement !== document.body && wrapper.contains(activeElement)) return;
        clearActive();
      });
    },
    markActive: (axis: LiveTableActiveAxis, rowIndex: number, colIndex: number): void => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
      });
      wrapper.querySelectorAll(".cm-live-table-selected").forEach((element) => {
        element.classList.remove("cm-live-table-selected");
      });
      const selector = axis === "column"
        ? `[data-column="${colIndex}"]`
        : axis === "row"
          ? `[data-row="${rowIndex}"]`
          : `[data-row="${rowIndex}"][data-column="${colIndex}"]`;
      wrapper.querySelectorAll(selector).forEach((element) => {
        element.classList.add("cm-live-table-active");
      });
      wrapper.dataset.activeAxis = axis;
      wrapper.dataset.activeRow = String(rowIndex);
      wrapper.dataset.activeCol = String(colIndex);
      delete wrapper.dataset.selectedRange;
    },
    markRange: (startRow: number, startCol: number, endRow: number, endCol: number): void => {
      activeRow = endRow;
      activeCol = endCol;
      positionControls();
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
      });
      wrapper.querySelectorAll(".cm-live-table-selected").forEach((element) => {
        element.classList.remove("cm-live-table-selected");
      });

      const fromRow = Math.min(startRow, endRow);
      const toRow = Math.max(startRow, endRow);
      const fromCol = Math.min(startCol, endCol);
      const toCol = Math.max(startCol, endCol);

      for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
        for (let colIndex = fromCol; colIndex <= toCol; colIndex += 1) {
          wrapper.querySelector(`[data-row="${rowIndex}"][data-column="${colIndex}"]`)?.classList.add("cm-live-table-selected");
        }
      }

      wrapper.dataset.activeAxis = "cell";
      wrapper.dataset.activeRow = String(endRow);
      wrapper.dataset.activeCol = String(endCol);
      wrapper.dataset.selectedRange = `${fromRow}:${fromCol}:${toRow}:${toCol}`;
    },
    positionControls,
    setAddAffordance: (rowIndex: number, colIndex: number): void => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      clearAffordance();

      if (rowIndex === 0) wrapper.dataset.canAddColumnAfter = "true";
      if (colIndex === colCount - 1) wrapper.dataset.canAddRowAfter = "true";
      if (rowIndex === 0) wrapper.dataset.canGrabColumn = "true";
      if (colIndex === 0) wrapper.dataset.canGrabRow = "true";
    }
  };

  positionControls();
  return state;
}
