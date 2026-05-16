import { WidgetType } from "@codemirror/view";

import {
  insertTableRow,
  moveTableColumnTo,
  moveTableRowTo,
  tableColumnCount,
  tableRowsFingerprint,
  withTableCellValue,
  type TableBlock
} from "./editorTableModel";
import {
  createTableEdgeAddButton,
  findTableWidgetView,
  focusTableWidgetCell,
  updateTableWidgetRows
} from "./editorTableWidgetDom";
import { createLiveTableDragController } from "./editorTableWidgetDrag";
import { showLiveTableMenu } from "./editorTableWidgetMenu";
import { createLiveTableInteractionState } from "./editorTableWidgetState";

export class TableWidget extends WidgetType {
  constructor(private readonly block: TableBlock) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      tableRowsFingerprint(this.block.rows) === tableRowsFingerprint(other.block.rows)
    );
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-live-table";
    const table = document.createElement("table");
    const colCount = tableColumnCount(this.block.rows);
    const rowCount = this.block.rows.length;
    const state = createLiveTableInteractionState(wrapper, rowCount, colCount);
    const focusCell = (rowIndex: number, colIndex: number): void => {
      focusTableWidgetCell(wrapper, rowIndex, colIndex);
    };
    const updateRows = (rows: string[][]): void => {
      const view = findTableWidgetView(wrapper);
      if (view) updateTableWidgetRows(view, this.block, rows);
    };
    const drag = createLiveTableDragController({
      colCount,
      getActiveCol: () => state.activeCol,
      getActiveRow: () => state.activeRow,
      onMove: ({ axis, sourceCol, sourceRow, targetCol, targetRow }) => {
        if (axis === "column" && targetCol !== sourceCol) {
          updateRows(moveTableColumnTo(this.block.rows, sourceCol, targetCol));
          focusCell(Math.min(sourceRow, this.block.rows.length - 1), targetCol);
        } else if (axis === "row" && targetRow !== sourceRow && sourceRow > 0 && targetRow > 0) {
          updateRows(moveTableRowTo(this.block.rows, sourceRow, targetRow));
          focusCell(targetRow, sourceCol);
        }
      },
      rowCount,
      table,
      wrapper
    });

    this.block.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      Array.from({ length: colCount }, (_, colIndex) => row[colIndex] ?? "").forEach((cell, colIndex) => {
        const td = document.createElement(rowIndex === 0 ? "th" : "td");
        td.dataset.row = String(rowIndex);
        td.dataset.column = String(colIndex);
        td.addEventListener("dragover", (event) => {
          if (wrapper.dataset.dragAxis) event.preventDefault();
        });
        td.addEventListener("drop", (event) => {
          event.preventDefault();
          event.stopPropagation();
          drag.moveDraggedSelection(rowIndex, colIndex);
        });

        const input = document.createElement("input");
        input.className = "cm-live-table-cell-input";
        input.dataset.row = String(rowIndex);
        input.dataset.col = String(colIndex);
        input.value = cell;
        const updateCell = (): void => {
          const view = findTableWidgetView(input);
          if (view) updateTableWidgetRows(view, this.block, withTableCellValue(this.block.rows, rowIndex, colIndex, input.value));
        };

        input.addEventListener("focus", () => state.markActive("cell", rowIndex, colIndex));
        input.addEventListener("mouseenter", () => {
          state.setAddAffordance(rowIndex, colIndex);
        });
        td.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.markActive("cell", rowIndex, colIndex);
          showLiveTableMenu({
            block: this.block,
            colIndex,
            event,
            focusCell,
            rowIndex,
            updateRows,
            wrapper
          });
        });
        input.addEventListener("blur", updateCell);
        input.addEventListener("blur", (event) => state.clearIfFocusOutside((event as FocusEvent).relatedTarget));
        input.addEventListener("change", updateCell);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const view = findTableWidgetView(input);
            if (!view) return;
            const nextRow = rowIndex + 1;
            let rows = withTableCellValue(this.block.rows, rowIndex, colIndex, input.value);
            if (nextRow >= rows.length) {
              rows = insertTableRow(rows, rows.length);
            }
            updateTableWidgetRows(view, this.block, rows);
            focusCell(nextRow, colIndex);
          } else if (event.key === "Tab") {
            event.preventDefault();
            const view = findTableWidgetView(input);
            if (!view) return;
            let rows = withTableCellValue(this.block.rows, rowIndex, colIndex, input.value);
            const direction = event.shiftKey ? -1 : 1;
            let nextRow = rowIndex;
            let nextCol = colIndex + direction;
            if (nextCol >= colCount) {
              nextCol = 0;
              nextRow += 1;
            } else if (nextCol < 0) {
              nextRow = Math.max(0, nextRow - 1);
              nextCol = colCount - 1;
            }
            if (nextRow >= rows.length) {
              rows = insertTableRow(rows, rows.length);
            }
            updateTableWidgetRows(view, this.block, rows);
            focusCell(nextRow, nextCol);
          }
        });
        td.append(input);
        tr.append(td);
      });

      table.append(tr);
    });

    wrapper.append(table);
    wrapper.append(this.coordinateHandle("column", "列を選択", state, drag.beginCoordinateDrag, wrapper));
    wrapper.append(this.coordinateHandle("row", "行を選択", state, drag.beginCoordinateDrag, wrapper));
    wrapper.append(createTableEdgeAddButton({ axis: "column-before", block: this.block, getFocusIndex: () => state.activeRow, getInsertIndex: () => state.activeCol }));
    wrapper.append(createTableEdgeAddButton({ axis: "column-after", block: this.block, getFocusIndex: () => state.activeRow, getInsertIndex: () => state.activeCol + 1 }));
    wrapper.append(createTableEdgeAddButton({ axis: "row-before", block: this.block, getFocusIndex: () => state.activeCol, getInsertIndex: () => Math.max(1, state.activeRow) }));
    wrapper.append(createTableEdgeAddButton({ axis: "row-after", block: this.block, getFocusIndex: () => state.activeCol, getInsertIndex: () => state.activeRow + 1 }));
    wrapper.addEventListener("focusout", (event) => {
      state.clearIfFocusOutside((event as FocusEvent).relatedTarget);
    });
    wrapper.addEventListener("mouseleave", () => {
      if (!wrapper.dataset.dragAxis) state.clearAffordance();
    });
    wrapper.addEventListener("dragover", (event) => {
      if (wrapper.dataset.dragAxis) event.preventDefault();
    });
    wrapper.addEventListener("drop", (event) => {
      if (!wrapper.dataset.dragAxis) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target instanceof HTMLElement
        ? event.target.closest("[data-row][data-column]")
        : null;
      if (target instanceof HTMLElement) {
        drag.moveDraggedSelection(Number(target.dataset.row ?? 0), Number(target.dataset.column ?? 0));
      }
    });

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  private coordinateHandle(
    axis: "column" | "row",
    title: string,
    state: ReturnType<typeof createLiveTableInteractionState>,
    beginCoordinateDrag: (axis: "column" | "row", event: MouseEvent | PointerEvent) => void,
    wrapper: HTMLElement
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = `cm-live-table-handle cm-live-table-handle--${axis}`;
    button.type = "button";
    button.title = title;
    button.textContent = "•••";
    const markAxis = (): void => {
      state.markActive(axis, state.activeRow, state.activeCol);
    };
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markAxis();
    });
    button.addEventListener("mouseenter", () => {
      if (axis === "column") {
        state.setAddAffordance(0, state.activeCol);
        wrapper.dataset.canGrabColumn = "true";
      } else {
        state.setAddAffordance(state.activeRow, 0);
        wrapper.dataset.canGrabRow = "true";
      }
    });
    button.addEventListener("pointerdown", (event) => {
      markAxis();
      beginCoordinateDrag(axis, event);
    });
    button.addEventListener("mousedown", (event) => {
      if (typeof window.PointerEvent === "function") return;
      markAxis();
      beginCoordinateDrag(axis, event);
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markAxis();
      showLiveTableMenu({
        block: this.block,
        colIndex: state.activeCol,
        event,
        focusCell: (rowIndex, colIndex) => focusTableWidgetCell(wrapper, rowIndex, colIndex),
        rowIndex: state.activeRow,
        updateRows: (rows) => {
          const view = findTableWidgetView(wrapper);
          if (view) updateTableWidgetRows(view, this.block, rows);
        },
        wrapper
      });
    });
    return button;
  }
}
