import { WidgetType } from "@codemirror/view";

import { writeEditorClipboardText } from "./editorClipboard";
import { colorValueFromTableCell, createColorSwatch } from "./colorSwatches";
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
import {
  canMoveHorizontallyWithArrow,
  clearSelectedRange,
  parsePastedTableCells,
  selectedRangeFromDataset,
  selectedRangeText,
  withPastedTableCells
} from "./editorTableWidgetModel";
import { createLiveTableInteractionState } from "./editorTableWidgetState";
import type { Translator } from "./i18nModel";

export class TableWidget extends WidgetType {
  constructor(
    private readonly block: TableBlock,
    private readonly t: Translator
  ) {
    super();
  }

  override eq(other: TableWidget): boolean {
    return (
      this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      tableRowsFingerprint(this.block.rows) === tableRowsFingerprint(other.block.rows)
    );
  }

  override toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-live-table";
    wrapper.tabIndex = -1;
    const table = document.createElement("table");
    const colCount = tableColumnCount(this.block.rows);
    const rowCount = this.block.rows.length;
    const state = createLiveTableInteractionState(wrapper, rowCount, colCount);
    let rangeSelection: { endCol: number; endRow: number; moved: boolean; startCol: number; startRow: number } | null = null;
    const focusCell = (rowIndex: number, colIndex: number): void => {
      focusTableWidgetCell(wrapper, rowIndex, colIndex);
    };
    const updateRows = (rows: string[][]): void => {
      const view = findTableWidgetView(wrapper);
      if (view) updateTableWidgetRows(view, this.block, rows);
    };
    const resizeCellInput = (input: HTMLTextAreaElement): void => {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    };
    const startRangeSelection = (event: MouseEvent | PointerEvent, rowIndex: number, colIndex: number): void => {
      if (event.button !== 0) return;
      if (wrapper.dataset.dragAxis) return;

      event.preventDefault();
      event.stopPropagation();
      rangeSelection = {
        endCol: colIndex,
        endRow: rowIndex,
        moved: false,
        startCol: colIndex,
        startRow: rowIndex
      };
      state.markActive("cell", rowIndex, colIndex);
      state.setAddAffordance(rowIndex, colIndex);
      wrapper.focus();
      const endRangeSelection = (): void => {
        if (!rangeSelection) return;
        const selection = rangeSelection;
        rangeSelection = null;
        if (selection.moved) {
          state.markRange(selection.startRow, selection.startCol, selection.endRow, selection.endCol);
          wrapper.focus();
        } else {
          focusCell(rowIndex, colIndex);
        }
        document.removeEventListener("pointerup", endRangeSelection);
        document.removeEventListener("mouseup", endRangeSelection);
      };
      document.addEventListener("pointerup", endRangeSelection);
      document.addEventListener("mouseup", endRangeSelection);
    };
    const extendRangeSelection = (rowIndex: number, colIndex: number): void => {
      if (!rangeSelection) return;
      rangeSelection.endRow = rowIndex;
      rangeSelection.endCol = colIndex;
      rangeSelection.moved = rangeSelection.moved || rowIndex !== rangeSelection.startRow || colIndex !== rangeSelection.startCol;
      state.markRange(rangeSelection.startRow, rangeSelection.startCol, rowIndex, colIndex);
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
        td.addEventListener("pointerdown", (event) => startRangeSelection(event, rowIndex, colIndex));
        td.addEventListener("mousedown", (event) => {
          if (typeof window.PointerEvent === "function") return;
          startRangeSelection(event, rowIndex, colIndex);
        });
        td.addEventListener("pointerenter", () => extendRangeSelection(rowIndex, colIndex));
        td.addEventListener("mouseenter", () => {
          if (typeof window.PointerEvent === "function") return;
          extendRangeSelection(rowIndex, colIndex);
        });

        const input = document.createElement("textarea");
        input.className = "cm-live-table-cell-input";
        input.dataset.row = String(rowIndex);
        input.dataset.col = String(colIndex);
        input.rows = 1;
        input.wrap = "soft";
        input.value = cell;
        const swatch = createColorSwatch("#000000");
        swatch.classList.add("cm-live-table-color-swatch");
        const updateColorSwatch = (): void => {
          const color = colorValueFromTableCell(input.value);
          td.classList.toggle("cm-live-table-color-cell", Boolean(color));
          swatch.hidden = !color;
          if (color) swatch.style.backgroundColor = color;
        };
        updateColorSwatch();
        requestAnimationFrame(() => resizeCellInput(input));
        const updateCell = (): void => {
          const view = findTableWidgetView(input);
          if (view) updateTableWidgetRows(view, this.block, withTableCellValue(this.block.rows, rowIndex, colIndex, input.value));
        };

        input.addEventListener("focus", () => state.markActive("cell", rowIndex, colIndex));
        input.addEventListener("input", () => {
          resizeCellInput(input);
          updateColorSwatch();
        });
        input.addEventListener("mouseenter", () => {
          state.setAddAffordance(rowIndex, colIndex);
        });
        td.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.markActive("cell", rowIndex, colIndex);
          const rows = withTableCellValue(this.block.rows, rowIndex, colIndex, input.value);
          showLiveTableMenu({
            block: { ...this.block, rows },
            colIndex,
            event,
            focusCell,
            rowIndex,
            t: this.t,
            updateRows
          });
        });
        input.addEventListener("blur", updateCell);
        input.addEventListener("blur", (event) => state.clearIfFocusOutside((event as FocusEvent).relatedTarget));
        input.addEventListener("change", updateCell);
        input.addEventListener("paste", (event) => {
          const text = event.clipboardData?.getData("text/plain") ?? "";
          const pastedRows = parsePastedTableCells(text);
          if (!pastedRows) return;

          event.preventDefault();
          event.stopPropagation();
          const view = findTableWidgetView(input);
          if (!view) return;
          updateTableWidgetRows(view, this.block, withPastedTableCells(this.block.rows, rowIndex, colIndex, pastedRows));
          focusCell(rowIndex, colIndex);
        });
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
          } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            const nextRow = event.key === "ArrowUp" ? rowIndex - 1 : rowIndex + 1;
            if (nextRow < 0 || nextRow >= rowCount) return;
            event.preventDefault();
            focusCell(nextRow, colIndex);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            if (!canMoveHorizontallyWithArrow({
              key: event.key,
              selectionEnd: input.selectionEnd,
              selectionStart: input.selectionStart,
              value: input.value
            })) return;
            const nextCol = event.key === "ArrowLeft" ? colIndex - 1 : colIndex + 1;
            if (nextCol < 0 || nextCol >= colCount) return;
            event.preventDefault();
            focusCell(rowIndex, nextCol);
          }
        });
        td.append(swatch, input);
        tr.append(td);
      });

      table.append(tr);
    });

    wrapper.append(table);
    wrapper.append(this.coordinateHandle("column", this.t("editor.tableSelectColumn"), state, drag.beginCoordinateDrag, wrapper));
    wrapper.append(this.coordinateHandle("row", this.t("editor.tableSelectRow"), state, drag.beginCoordinateDrag, wrapper));
    wrapper.append(createTableEdgeAddButton({ axis: "column-after", block: this.block, getFocusIndex: () => state.activeRow, getInsertIndex: () => tableColumnCount(this.block.rows), t: this.t }));
    wrapper.append(createTableEdgeAddButton({ axis: "row-after", block: this.block, getFocusIndex: () => state.activeCol, getInsertIndex: () => this.block.rows.length, t: this.t }));
    if (this.block.isAtDocumentEnd) wrapper.append(this.createContinuationInput(wrapper));
    wrapper.addEventListener("focusout", (event) => {
      state.clearIfFocusOutside((event as FocusEvent).relatedTarget);
    });
    wrapper.addEventListener("keydown", (event) => {
      const range = selectedRangeFromDataset(wrapper.dataset.selectedRange);
      if (!range) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        event.stopPropagation();
        void writeEditorClipboardText(selectedRangeText(this.block.rows, range));
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        event.stopPropagation();
        updateRows(clearSelectedRange(this.block.rows, range));
      }
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

  override ignoreEvent(): boolean {
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
    button.setAttribute("aria-label", title);
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
        t: this.t,
        updateRows: (rows) => {
          const view = findTableWidgetView(wrapper);
          if (view) updateTableWidgetRows(view, this.block, rows);
        }
      });
    });
    return button;
  }

  private createContinuationInput(wrapper: HTMLElement): HTMLTextAreaElement {
    const input = document.createElement("textarea");
    input.className = "cm-live-table-continuation";
    input.rows = 1;
    input.spellcheck = true;
    input.placeholder = "";
    input.addEventListener("input", () => {
      const text = input.value;
      if (text.length === 0) return;

      const view = findTableWidgetView(wrapper);
      if (!view) return;
      view.dispatch({
        changes: { from: this.block.to, insert: `\n${text}` },
        scrollIntoView: true,
        selection: { anchor: this.block.to + text.length + 1 }
      });
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || input.value.length > 0) return;

      event.preventDefault();
      const view = findTableWidgetView(wrapper);
      if (!view) return;
      view.dispatch({
        changes: { from: this.block.to, insert: "\n" },
        scrollIntoView: true,
        selection: { anchor: this.block.to + 1 }
      });
    });
    return input;
  }
}
