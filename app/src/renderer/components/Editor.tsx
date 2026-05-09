import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, historyKeymap, history } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, StateField } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap, lineNumbers } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";

interface EditorProps {
  allFilePaths?: string[];
  content: string;
  onChange: (content: string) => void;
  settings: EditorSettings;
  typewriterMode?: boolean;
  viewRef?: React.MutableRefObject<EditorView | null>;
}

interface TableBlock {
  from: number;
  to: number;
  rows: string[][];
}

interface SourceRevealRange {
  from: number;
  to: number;
}

interface InlineMatch {
  from: number;
  to: number;
  contentFrom: number;
  contentTo: number;
  className: string;
  hideRanges: Array<{ from: number; to: number }>;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function formatTable(rows: string[][]): string {
  const colCount = Math.max(...rows.map((row) => row.length), 1);
  const normalized = rows.map((row) => Array.from({ length: colCount }, (_, i) => row[i] ?? ""));
  const divider = Array.from({ length: colCount }, () => "---");
  return [
    `| ${normalized[0].join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`)
  ].join("\n");
}

function findTableBlocks(state: EditorState): TableBlock[] {
  const blocks: TableBlock[] = [];
  const { doc } = state;
  let lineNumber = 1;

  while (lineNumber < doc.lines) {
    const headerLine = doc.line(lineNumber);
    const dividerLine = doc.line(lineNumber + 1);

    if (!headerLine.text.includes("|") || !isTableDivider(dividerLine.text)) {
      lineNumber += 1;
      continue;
    }

    const rows = [splitTableRow(headerLine.text)];
    let endLine = dividerLine;
    let cursor = lineNumber + 2;

    while (cursor <= doc.lines) {
      const rowLine = doc.line(cursor);
      if (!rowLine.text.includes("|") || rowLine.text.trim() === "") break;
      rows.push(splitTableRow(rowLine.text));
      endLine = rowLine;
      cursor += 1;
    }

    blocks.push({ from: headerLine.from, to: endLine.to, rows });
    lineNumber = cursor;
  }

  return blocks;
}

class TableWidget extends WidgetType {
  private static clipboard:
    | { type: "row"; cells: string[] }
    | { type: "column"; cells: string[] }
    | null = null;

  constructor(private readonly block: TableBlock) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.block.from === other.block.from &&
      this.block.to === other.block.to &&
      this.block.rows.map((row) => row.join("\u0000")).join("\u0001") ===
        other.block.rows.map((row) => row.join("\u0000")).join("\u0001")
    );
  }

  private findView(element: HTMLElement): EditorView | null {
    const editor = element.closest(".cm-editor");
    return editor instanceof HTMLElement ? EditorView.findFromDOM(editor) : EditorView.findFromDOM(element);
  }

  private focusCell(wrapper: HTMLElement, rowIndex: number, colIndex: number): void {
    const searchRoot = wrapper.closest(".cm-editor") ?? document;
    requestAnimationFrame(() => {
      const input = searchRoot.querySelector(
        `.cm-live-table-cell-input[data-row="${rowIndex}"][data-col="${colIndex}"]`
      );
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    });
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-live-table";
    const table = document.createElement("table");
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    const rowCount = this.block.rows.length;
    let activeRow = Math.min(1, rowCount - 1);
    let activeCol = 0;

    const positionControls = () => {
      const colStart = (activeCol / colCount) * 100;
      const colCenter = ((activeCol + 0.5) / colCount) * 100;
      const colAfter = ((activeCol + 1) / colCount) * 100;
      const rowStart = (activeRow / rowCount) * 100;
      const rowCenter = ((activeRow + 0.5) / rowCount) * 100;
      const rowAfter = ((activeRow + 1) / rowCount) * 100;
      wrapper.style.setProperty("--table-active-col-start", `${colStart}%`);
      wrapper.style.setProperty("--table-active-col-center", `${colCenter}%`);
      wrapper.style.setProperty("--table-active-col-after", `${colAfter}%`);
      wrapper.style.setProperty("--table-active-col-width", `${100 / colCount}%`);
      wrapper.style.setProperty("--table-active-row-start", `${rowStart}%`);
      wrapper.style.setProperty("--table-active-row-center", `${rowCenter}%`);
      wrapper.style.setProperty("--table-active-row-after", `${rowAfter}%`);
      wrapper.style.setProperty("--table-active-row-height", `${100 / rowCount}%`);
    };

    const markActive = (axis: "row" | "column" | "cell", rowIndex: number, colIndex: number) => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
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
    };

    const setAddAffordance = (rowIndex: number, colIndex: number) => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      delete wrapper.dataset.canAddColumnBefore;
      delete wrapper.dataset.canAddColumnAfter;
      delete wrapper.dataset.canAddRowBefore;
      delete wrapper.dataset.canAddRowAfter;

      if (rowIndex === 0) wrapper.dataset.canAddColumnAfter = "true";
      if (rowIndex === rowCount - 1) wrapper.dataset.canAddColumnBefore = "true";
      if (colIndex === 0) wrapper.dataset.canAddRowBefore = "true";
      if (colIndex === colCount - 1) wrapper.dataset.canAddRowAfter = "true";
    };

    const clearActive = () => {
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
      });
      delete wrapper.dataset.activeAxis;
      delete wrapper.dataset.activeRow;
      delete wrapper.dataset.activeCol;
      delete wrapper.dataset.canAddColumnBefore;
      delete wrapper.dataset.canAddColumnAfter;
      delete wrapper.dataset.canAddRowBefore;
      delete wrapper.dataset.canAddRowAfter;
    };

    const moveDraggedSelection = (targetRow: number, targetCol: number) => {
      const axis = wrapper.dataset.dragAxis;
      const sourceRow = Number(wrapper.dataset.dragSourceRow ?? activeRow);
      const sourceCol = Number(wrapper.dataset.dragSourceCol ?? activeCol);
      const view = this.findView(wrapper);
      if (!view || !axis) return;

      if (axis === "column" && targetCol !== sourceCol) {
        this.update(view, this.moveColTo(sourceCol, targetCol));
        this.focusCell(wrapper, Math.min(sourceRow, this.block.rows.length - 1), targetCol);
      } else if (axis === "row" && targetRow !== sourceRow && sourceRow > 0 && targetRow > 0) {
        this.update(view, this.moveRowTo(sourceRow, targetRow));
        this.focusCell(wrapper, targetRow, sourceCol);
      }
    };

    const setDropTarget = (targetRow: number, targetCol: number) => {
      const axis = wrapper.dataset.dragAxis;
      if (!axis) return;
      wrapper.dataset.dragTargetRow = String(targetRow);
      wrapper.dataset.dragTargetCol = String(targetCol);
      wrapper.style.setProperty("--table-drop-col", `${(targetCol / colCount) * 100}%`);
      wrapper.style.setProperty("--table-drop-row", `${(targetRow / rowCount) * 100}%`);
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
      const col = Math.max(0, Math.min(colCount - 1, Math.floor(((clientX - rect.left) / rect.width) * colCount)));
      const row = Math.max(1, Math.min(rowCount - 1, Math.floor(((clientY - rect.top) / rect.height) * rowCount)));
      return { row, col };
    };

    const targetFromEvent = (event: MouseEvent | PointerEvent): { row: number; col: number } | null => {
      const cell = event.target instanceof HTMLElement ? event.target.closest("[data-row][data-column]") : null;
      if (cell instanceof HTMLElement && wrapper.contains(cell)) return targetFromCell(cell);
      return targetFromPoint(event.clientX, event.clientY);
    };

    const beginCoordinateDrag = (
      axis: "column" | "row",
      clientX: number,
      clientY: number,
      preventDefault: () => void
    ) => {
      preventDefault();
      const sourceRow = activeRow;
      const sourceCol = activeCol;
      wrapper.dataset.dragAxis = axis;
      wrapper.dataset.dragSourceRow = String(sourceRow);
      wrapper.dataset.dragSourceCol = String(sourceCol);
      setDropTarget(sourceRow, sourceCol);
      const firstTarget = targetFromPoint(clientX, clientY);
      if (firstTarget) setDropTarget(firstTarget.row, firstTarget.col);

      const move = (moveEvent: MouseEvent | PointerEvent) => {
        const target = targetFromEvent(moveEvent);
        if (target) {
          setDropTarget(target.row, target.col);
        }
      };
      const up = (upEvent: MouseEvent | PointerEvent) => {
        const target = targetFromEvent(upEvent);
        if (target) {
          moveDraggedSelection(target.row, target.col);
        }
        delete wrapper.dataset.dragAxis;
        delete wrapper.dataset.dragSourceRow;
        delete wrapper.dataset.dragSourceCol;
        delete wrapper.dataset.dragTargetRow;
        delete wrapper.dataset.dragTargetCol;
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
    positionControls();

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
          moveDraggedSelection(rowIndex, colIndex);
        });
        const input = document.createElement("input");
        input.className = "cm-live-table-cell-input";
        input.dataset.row = String(rowIndex);
        input.dataset.col = String(colIndex);
        input.value = cell;
        const updateCell = () => {
          const view = this.findView(input);
          if (view) this.updateCell(view, rowIndex, colIndex, input.value);
        };
        input.addEventListener("focus", () => markActive("cell", rowIndex, colIndex));
        input.addEventListener("mouseenter", () => {
          activeRow = rowIndex;
          activeCol = colIndex;
          positionControls();
          setAddAffordance(rowIndex, colIndex);
        });
        td.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          markActive("cell", rowIndex, colIndex);
          this.showMenu(wrapper, event, rowIndex, colIndex);
        });
        input.addEventListener("blur", updateCell);
        input.addEventListener("blur", () => {
          requestAnimationFrame(() => {
            if (!wrapper.contains(document.activeElement)) clearActive();
          });
        });
        input.addEventListener("change", updateCell);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const view = this.findView(input);
            if (!view) return;
            const nextRow = rowIndex + 1;
            const rows = this.withCellValue(rowIndex, colIndex, input.value);
            if (nextRow >= rows.length) {
              rows.push(Array.from({ length: colCount }, () => ""));
            }
            this.update(view, rows);
            this.focusCell(wrapper, nextRow, colIndex);
          } else if (event.key === "Tab") {
            event.preventDefault();
            const view = this.findView(input);
            if (!view) return;
            const rows = this.withCellValue(rowIndex, colIndex, input.value);
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
              rows.push(Array.from({ length: colCount }, () => ""));
            }
            this.update(view, rows);
            this.focusCell(wrapper, nextRow, nextCol);
          }
        });
        td.append(input);
        tr.append(td);
      });

      table.append(tr);
    });

    wrapper.append(table);
    const columnHandle = document.createElement("button");
    columnHandle.className = "cm-live-table-handle cm-live-table-handle--column";
    columnHandle.type = "button";
    columnHandle.title = "列を選択";
    columnHandle.textContent = "•••";
    columnHandle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("column", activeRow, activeCol);
    });
    columnHandle.addEventListener("mouseenter", () => {
      setAddAffordance(0, activeCol);
    });
    columnHandle.addEventListener("pointerdown", (event) => {
      markActive("column", activeRow, activeCol);
      beginCoordinateDrag("column", event.clientX, event.clientY, () => event.preventDefault());
    });
    columnHandle.addEventListener("mousedown", (event) => {
      markActive("column", activeRow, activeCol);
      beginCoordinateDrag("column", event.clientX, event.clientY, () => event.preventDefault());
    });
    columnHandle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("column", activeRow, activeCol);
      this.showMenu(wrapper, event, activeRow, activeCol);
    });
    wrapper.append(columnHandle);
    const rowHandle = document.createElement("button");
    rowHandle.className = "cm-live-table-handle cm-live-table-handle--row";
    rowHandle.type = "button";
    rowHandle.title = "行を選択";
    rowHandle.textContent = "•••";
    rowHandle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("row", activeRow, activeCol);
    });
    rowHandle.addEventListener("mouseenter", () => {
      setAddAffordance(activeRow, 0);
    });
    rowHandle.addEventListener("pointerdown", (event) => {
      markActive("row", activeRow, activeCol);
      beginCoordinateDrag("row", event.clientX, event.clientY, () => event.preventDefault());
    });
    rowHandle.addEventListener("mousedown", (event) => {
      markActive("row", activeRow, activeCol);
      beginCoordinateDrag("row", event.clientX, event.clientY, () => event.preventDefault());
    });
    rowHandle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markActive("row", activeRow, activeCol);
      this.showMenu(wrapper, event, activeRow, activeCol);
    });
    wrapper.append(rowHandle);
    wrapper.append(this.edgeAddButton("column-before", () => activeCol, () => activeRow));
    wrapper.append(this.edgeAddButton("column-after", () => activeCol + 1, () => activeRow));
    wrapper.append(this.edgeAddButton("row-before", () => Math.max(1, activeRow), () => activeCol));
    wrapper.append(this.edgeAddButton("row-after", () => activeRow + 1, () => activeCol));
    wrapper.addEventListener("focusout", () => {
      requestAnimationFrame(() => {
        if (!wrapper.contains(document.activeElement)) clearActive();
      });
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
        moveDraggedSelection(Number(target.dataset.row ?? 0), Number(target.dataset.column ?? 0));
      }
    });

    return wrapper;
  }

  ignoreEvent(): boolean {
    return true;
  }

  private showMenu(wrapper: HTMLElement, event: MouseEvent, rowIndex: number, colIndex: number): void {
    wrapper.querySelector(".cm-live-table-menu")?.remove();
    const view = this.findView(wrapper);
    if (!view) return;

    const menu = document.createElement("div");
    menu.className = "cm-live-table-menu";
    const rect = wrapper.getBoundingClientRect();
    menu.style.left = `${event.clientX - rect.left}px`;
    menu.style.top = `${event.clientY - rect.top}px`;

    const addItem = (
      label: string,
      action: () => void,
      disabled = false
    ) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        if (!disabled) {
          action();
          menu.remove();
        }
      });
      menu.append(button);
    };

    const separator = () => {
      const hr = document.createElement("div");
      hr.className = "cm-live-table-menu-separator";
      menu.append(hr);
    };

    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    addItem("行を上に追加", () => {
      this.update(view, this.insertRow(Math.max(1, rowIndex)));
      this.focusCell(wrapper, Math.max(1, rowIndex), colIndex);
    }, rowIndex === 0);
    addItem("行を下に追加", () => {
      this.update(view, this.insertRow(rowIndex + 1));
      this.focusCell(wrapper, rowIndex + 1, colIndex);
    });
    addItem("行を削除", () => {
      this.update(view, this.deleteRow(rowIndex));
      this.focusCell(wrapper, Math.max(1, Math.min(rowIndex, this.block.rows.length - 2)), colIndex);
    }, rowIndex === 0 || this.block.rows.length <= 2);
    addItem("行を上へ移動", () => {
      this.update(view, this.moveRow(rowIndex, -1));
      this.focusCell(wrapper, rowIndex - 1, colIndex);
    }, rowIndex <= 1);
    addItem("行を下へ移動", () => {
      this.update(view, this.moveRow(rowIndex, 1));
      this.focusCell(wrapper, rowIndex + 1, colIndex);
    }, rowIndex === 0 || rowIndex >= this.block.rows.length - 1);
    addItem("行をコピー", () => {
      TableWidget.clipboard = { type: "row", cells: [...this.block.rows[rowIndex]] };
    });
    addItem("コピーした行を下に貼り付け", () => {
      if (TableWidget.clipboard?.type !== "row") return;
      const rows = this.block.rows.map((row) => [...row]);
      rows.splice(rowIndex + 1, 0, Array.from({ length: colCount }, (_, i) => TableWidget.clipboard?.cells[i] ?? ""));
      this.update(view, rows);
      this.focusCell(wrapper, rowIndex + 1, colIndex);
    }, TableWidget.clipboard?.type !== "row");

    separator();

    addItem("列を左に追加", () => {
      this.update(view, this.insertCol(colIndex));
      this.focusCell(wrapper, rowIndex, colIndex);
    });
    addItem("列を右に追加", () => {
      this.update(view, this.insertCol(colIndex + 1));
      this.focusCell(wrapper, rowIndex, colIndex + 1);
    });
    addItem("列を削除", () => {
      this.update(view, this.deleteCol(colIndex));
      this.focusCell(wrapper, rowIndex, Math.max(0, colIndex - 1));
    }, colCount <= 1);
    addItem("列を左へ移動", () => {
      this.update(view, this.moveCol(colIndex, -1));
      this.focusCell(wrapper, rowIndex, colIndex - 1);
    }, colIndex <= 0);
    addItem("列を右へ移動", () => {
      this.update(view, this.moveCol(colIndex, 1));
      this.focusCell(wrapper, rowIndex, colIndex + 1);
    }, colIndex >= colCount - 1);
    addItem("列を昇順に並べ替え", () => {
      this.update(view, this.sortByCol(colIndex, "asc"));
      this.focusCell(wrapper, Math.min(1, this.block.rows.length - 1), colIndex);
    });
    addItem("列を降順に並べ替え", () => {
      this.update(view, this.sortByCol(colIndex, "desc"));
      this.focusCell(wrapper, Math.min(1, this.block.rows.length - 1), colIndex);
    });
    addItem("列をコピー", () => {
      TableWidget.clipboard = { type: "column", cells: this.block.rows.map((row) => row[colIndex] ?? "") };
    });
    addItem("コピーした列を右に貼り付け", () => {
      if (TableWidget.clipboard?.type !== "column") return;
      const rows = this.block.rows.map((row, rowIndex) => {
        const next = [...row];
        next.splice(colIndex + 1, 0, TableWidget.clipboard?.cells[rowIndex] ?? "");
        return next;
      });
      this.update(view, rows);
      this.focusCell(wrapper, rowIndex, colIndex + 1);
    }, TableWidget.clipboard?.type !== "column");

    wrapper.append(menu);
    const dismiss = (dismissEvent: MouseEvent) => {
      if (!menu.contains(dismissEvent.target as Node)) {
        menu.remove();
        document.removeEventListener("mousedown", dismiss);
      }
    };
    requestAnimationFrame(() => document.addEventListener("mousedown", dismiss));
  }

  private edgeAddButton(
    axis: "column-before" | "column-after" | "row-before" | "row-after",
    getInsertIndex: () => number,
    getFocusIndex: () => number
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cm-live-table-add cm-live-table-add--${axis}`;
    button.textContent = "+";
    button.title = axis.startsWith("column")
      ? axis.endsWith("before") ? "Add column before" : "Add column after"
      : axis.endsWith("before") ? "Add row before" : "Add row after";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const view = this.findView(button);
      if (!view) return;
      const index = getInsertIndex();
      const isColumn = axis.startsWith("column");
      const rows = isColumn ? this.insertCol(index) : this.insertRow(index);
      this.update(view, rows);
      this.focusCell(
        button,
        isColumn ? Math.min(getFocusIndex(), this.block.rows.length - 1) : index,
        isColumn ? index : getFocusIndex()
      );
    });
    return button;
  }

  private update(view: EditorView, rows: string[][]): void {
    view.dispatch({
      changes: {
        from: this.block.from,
        to: this.block.to,
        insert: formatTable(rows)
      }
    });
  }

  private withCellValue(rowIndex: number, colIndex: number, value: string): string[][] {
    return this.block.rows.map((row, currentRowIndex) => {
      const next = [...row];
      if (currentRowIndex === rowIndex) next[colIndex] = value;
      return next;
    });
  }

  private updateCell(view: EditorView, rowIndex: number, colIndex: number, value: string): void {
    this.update(view, this.withCellValue(rowIndex, colIndex, value));
  }

  private insertRow(index: number): string[][] {
    const colCount = Math.max(...this.block.rows.map((row) => row.length), 1);
    const rows = this.block.rows.map((row) => [...row]);
    rows.splice(index, 0, Array.from({ length: colCount }, () => ""));
    return rows;
  }

  private deleteRow(index: number): string[][] {
    return this.block.rows.filter((_, rowIndex) => rowIndex !== index);
  }

  private insertCol(index: number): string[][] {
    return this.block.rows.map((row) => {
      const next = [...row];
      next.splice(index, 0, "");
      return next;
    });
  }

  private deleteCol(index: number): string[][] {
    return this.block.rows.map((row) => row.filter((_, colIndex) => colIndex !== index));
  }

  private moveRow(index: number, direction: -1 | 1): string[][] {
    const rows = this.block.rows.map((row) => [...row]);
    const target = index + direction;
    if (index <= 0 || target <= 0 || target >= rows.length) return rows;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    return rows;
  }

  private moveRowTo(from: number, to: number): string[][] {
    const rows = this.block.rows.map((row) => [...row]);
    if (from <= 0 || to <= 0 || from >= rows.length || to >= rows.length) return rows;
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row);
    return rows;
  }

  private moveCol(index: number, direction: -1 | 1): string[][] {
    return this.block.rows.map((row) => {
      const next = [...row];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  private moveColTo(from: number, to: number): string[][] {
    return this.block.rows.map((row) => {
      const next = [...row];
      if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
      const [cell] = next.splice(from, 1);
      next.splice(to, 0, cell);
      return next;
    });
  }

  private sortByCol(index: number, direction: "asc" | "desc"): string[][] {
    const [header, ...body] = this.block.rows.map((row) => [...row]);
    body.sort((left, right) => {
      const result = (left[index] ?? "").localeCompare(right[index] ?? "", undefined, {
        numeric: true,
        sensitivity: "base"
      });
      return direction === "asc" ? result : -result;
    });
    return [header, ...body];
  }
}

class ListMarkerWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly className: string
  ) {
    super();
  }

  eq(other: ListMarkerWidget): boolean {
    return this.label === other.label && this.className === other.className;
  }

  toDOM(): HTMLElement {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.label;
    return marker;
  }
}

class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked;
  }

  toDOM(): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.className = "cm-live-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.tabIndex = -1;
    return checkbox;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement("hr");
    hr.className = "cm-live-hr";
    return hr;
  }
}

function overlaps(from: number, to: number, ranges: Array<{ from: number; to: number }>): boolean {
  return ranges.some((range) => from < range.to && to > range.from);
}

function collectRegexMatches(
  text: string,
  regex: RegExp,
  createMatch: (match: RegExpExecArray) => InlineMatch | null
): InlineMatch[] {
  const matches: InlineMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const inlineMatch = createMatch(match);
    if (inlineMatch) matches.push(inlineMatch);
    if (match[0].length === 0) regex.lastIndex += 1;
  }

  return matches;
}

export function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const tableBlocks = findTableBlocks(state);
  const sourceRevealRanges: SourceRevealRange[] = [];

  function selectionTouches(from: number, to: number): boolean {
    if (!editorHasFocus) return false;

    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from >= from && range.from <= to;
      return range.from <= to && range.to >= from;
    });
  }

  function addSourceReveal(from: number, to: number) {
    if (from < to && selectionTouches(from, to)) sourceRevealRanges.push({ from, to });
  }

  function shouldRevealSource(from: number, to: number): boolean {
    return sourceRevealRanges.some((range) => from >= range.from && to <= range.to);
  }

  function addReplace(from: number, to: number) {
    if (from < to && !shouldRevealSource(from, to)) ranges.push({ from, to, deco: Decoration.replace({}) });
  }

  function addMark(from: number, to: number, cls: string) {
    if (from < to) {
      const attributes = cls === "cm-live-bold" ? { style: "font-weight: 800;" } : undefined;
      ranges.push({ from, to, deco: Decoration.mark({ attributes, class: cls }) });
    }
  }

  function addWidget(from: number, to: number, widget: WidgetType) {
    if (from < to && !shouldRevealSource(from, to)) {
      ranges.push({ from, to, deco: Decoration.replace({ widget }) });
    }
  }

  function addInlineDecorations(lineFrom: number, text: string) {
    const occupied: Array<{ from: number; to: number }> = [];
    const matches: InlineMatch[] = [];

    matches.push(...collectRegexMatches(text, /`([^`\n]+)`/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-code",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /\[([^\]\n]+)\]\(([^)\n]+)\)/g, (match) => {
      const from = lineFrom + match.index;
      const textFrom = from + 1;
      const textTo = textFrom + match[1].length;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: textFrom,
        contentTo: textTo,
        className: "cm-live-link",
        hideRanges: [{ from, to: from + 1 }, { from: textTo, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /\[\[([^\]\n]+)\]\]/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      const separatorIndex = match[1].lastIndexOf("|");
      const contentOffset = separatorIndex >= 0 ? 2 + separatorIndex + 1 : 2;
      const contentLength = separatorIndex >= 0 ? match[1].length - separatorIndex - 1 : match[1].length;
      const contentFrom = from + contentOffset;
      const contentTo = contentFrom + contentLength;
      const hideRanges = separatorIndex >= 0
        ? [{ from, to: contentFrom }, { from: to - 2, to }]
        : [{ from, to: from + 2 }, { from: to - 2, to }];
      return {
        from,
        to,
        contentFrom,
        contentTo,
        className: "cm-live-link",
        hideRanges
      };
    }));

    matches.push(...collectRegexMatches(text, /\*\*([^*\n]+)\*\*/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-bold",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /__([^_\n]+)__/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-bold",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /~~([^~\n]+)~~/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-strike",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /==([^=\n]+)==/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 2,
        contentTo: to - 2,
        className: "cm-live-highlight",
        hideRanges: [{ from, to: from + 2 }, { from: to - 2, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /<u>([^<\n]+)<\/u>/g, (match) => {
      const from = lineFrom + match.index;
      const to = from + match[0].length;
      return {
        from,
        to,
        contentFrom: from + 3,
        contentTo: to - 4,
        className: "cm-live-underline",
        hideRanges: [{ from, to: from + 3 }, { from: to - 4, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /(^|[^\*])\*([^*\n]+)\*(?!\*)/g, (match) => {
      const markerOffset = match[1].length;
      const from = lineFrom + match.index + markerOffset;
      const to = from + match[0].length - markerOffset;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-italic",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.push(...collectRegexMatches(text, /(^|[^_])_([^_\n]+)_(?!_)/g, (match) => {
      const markerOffset = match[1].length;
      const from = lineFrom + match.index + markerOffset;
      const to = from + match[0].length - markerOffset;
      return {
        from,
        to,
        contentFrom: from + 1,
        contentTo: to - 1,
        className: "cm-live-italic",
        hideRanges: [{ from, to: from + 1 }, { from: to - 1, to }]
      };
    }));

    matches.sort((a, b) => a.from - b.from || b.to - a.to);

    for (const match of matches) {
      if (overlaps(match.from, match.to, occupied)) continue;
      occupied.push({ from: match.from, to: match.to });
      addSourceReveal(match.from, match.to);
      addMark(match.contentFrom, match.contentTo, match.className);
      for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
    }
  }

  function startsInsideFencedCode(lineNumber: number): boolean {
    let inFencedCode = false;

    for (let currentLine = 1; currentLine < lineNumber; currentLine += 1) {
      if (/^\s*```/.test(doc.line(currentLine).text)) inFencedCode = !inFencedCode;
    }

    return inFencedCode;
  }

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;
    let inFencedCode = startsInsideFencedCode(lineNumber);

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      const text = line.text;
      const tableBlock = tableBlocks.find((block) => line.from >= block.from && line.to <= block.to);

      if (/^\s*```/.test(text)) {
        addSourceReveal(line.from, line.to);
        addReplace(line.from, line.to);
        inFencedCode = !inFencedCode;
        lineNumber += 1;
        continue;
      }

      if (tableBlock) {
        lineNumber += 1;
        continue;
      }

      if (inFencedCode) {
        addMark(line.from, line.to, "cm-live-code-block");
        lineNumber += 1;
        continue;
      }

      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(text);
      if (headingMatch) {
        const markerFrom = line.from;
        const contentFrom = line.from + headingMatch[1].length + 1;
        addSourceReveal(line.from, line.to);
        addMark(contentFrom, line.to, `cm-live-h${headingMatch[1].length}`);
        addReplace(markerFrom, contentFrom);
        addInlineDecorations(contentFrom, text.slice(contentFrom - line.from));
      } else if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
        addSourceReveal(line.from, line.to);
        addWidget(line.from, line.to, new HorizontalRuleWidget());
      } else if (/^\s*>\s?/.test(text)) {
        const match = /^(\s*>\s?)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addReplace(line.from, contentFrom);
          addMark(contentFrom, line.to, "cm-live-blockquote");
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new CheckboxWidget(/[xX]/.test(match[2])));
          addInlineDecorations(contentFrom, match[3]);
        }
      } else if (/^\s*[-*+]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new ListMarkerWidget("•", "cm-live-list-marker"));
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*\d+[.)]\s+/.test(text)) {
        const match = /^(\s*)(\d+)([.)]\s+)(.*)$/.exec(text);
        if (match) {
          const markerTo = line.from + match[0].length - match[4].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, markerTo, new ListMarkerWidget(`${match[2]}.`, "cm-live-ordered-marker"));
          addInlineDecorations(markerTo, match[4]);
        }
      } else {
        addInlineDecorations(line.from, text);
      }

      lineNumber += 1;
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

export function buildTableDecorations(state: EditorState): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];

  for (const block of findTableBlocks(state)) {
    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({ widget: new TableWidget(block), block: true })
    });
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

const livePreviewTableField = StateField.define<DecorationSet>({
  create: (state) => buildTableDecorations(state),
  update: (_decorations, transaction) => buildTableDecorations(transaction.state),
  provide: (field) => EditorView.decorations.from(field)
});

const livePreviewPlugin = EditorView.decorations.of((view) => buildLivePreviewDecorations(view));

const typewriterExtension = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate): void {
      if (!update.selectionSet && !update.docChanged) return;

      const { view } = update;
      const cursor = view.state.selection.main.head;
      const line = view.lineBlockAt(cursor);
      const scroller = view.scrollDOM;
      const target = line.top - scroller.clientHeight / 2 + line.height / 2;

      scroller.scrollTop = Math.max(0, target);
    }
  }
);

const fontFamilyMap: Record<EditorSettings["font"], string> = {
  mincho: '"Hiragino Mincho ProN", serif',
  mono: "Menlo, monospace",
  system: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif'
};

export function buildWikiLinkCompletionSource(allFilePaths: string[]) {
  const basenameMap = new Map<string, string[]>();

  for (const filePath of allFilePaths) {
    const basename = filePath.split("/").at(-1)?.replace(/\.md$/, "") ?? "";

    if (!basename) continue;

    if (!basenameMap.has(basename)) basenameMap.set(basename, []);

    basenameMap.get(basename)!.push(filePath);
  }

  return (context: CompletionContext): CompletionResult | null => {
    const before = context.matchBefore(/\[\[([^\]\n]*)$/);

    if (!before || (!context.explicit && before.text === "[[")) return null;

    const options: { apply: string; label: string }[] = [];

    for (const [basename, paths] of basenameMap) {
      if (paths.length === 1) {
        options.push({ apply: `${basename}]]`, label: basename });
      } else {
        for (const filePath of paths) {
          const label = filePath.replace(/\.md$/, "");
          options.push({ apply: `${label}]]`, label });
        }
      }
    }

    return {
      filter: true,
      from: before.from + 2,
      options
    };
  };
}

function buildExtensions(
  settings: EditorSettings,
  typewriterMode: boolean,
  onChangeRef: React.RefObject<(c: string) => void>,
  allFilePaths: string[]
) {
  return [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown({ extensions: GFM }),
    autocompletion({ override: [buildWikiLinkCompletionSource(allFilePaths)] }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChangeRef.current!(update.state.doc.toString());
    }),
    EditorView.theme({
      "&": {
        fontFamily: fontFamilyMap[settings.font],
        fontSize: `${settings.fontSize}px`,
        lineHeight: String(settings.lineHeight),
        height: "100%"
      },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": {
        maxWidth: settings.maxWidth === "none" ? "none" : settings.maxWidth,
        margin: "0 auto",
        padding: "24px 32px"
      },
      ".cm-focused": { outline: "none" }
    }),
    EditorView.contentAttributes.of({ spellcheck: settings.spellCheck ? "true" : "false" }),
    ...(settings.showLineNumbers ? [lineNumbers()] : []),
    ...(typewriterMode ? [typewriterExtension] : []),
    livePreviewTableField,
    livePreviewPlugin
  ];
}

export function Editor({
  allFilePaths = [],
  content,
  onChange,
  settings,
  typewriterMode = false,
  viewRef
}: EditorProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const allFilePathsRef = useRef(allFilePaths);

  onChangeRef.current = onChange;
  allFilePathsRef.current = allFilePaths;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = buildExtensions(settings, typewriterMode, onChangeRef, allFilePathsRef.current);
    const state = EditorState.create({ doc: content, extensions });
    const view = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = view;

    if (viewRef) viewRef.current = view;

    return () => {
      view.destroy();
      internalViewRef.current = null;
      if (viewRef) viewRef.current = null;
    };
    // content は初期値のみ使用。以降は onChange で管理する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 設定・タイプライターモード変更時にエディタを再生成
  useEffect(() => {
    const view = internalViewRef.current;

    if (!view) return;

    const currentContent = view.state.doc.toString();

    view.destroy();
    internalViewRef.current = null;

    if (!containerRef.current) return;

    const extensions = buildExtensions(settings, typewriterMode, onChangeRef, allFilePathsRef.current);
    const state = EditorState.create({ doc: currentContent, extensions });
    const nextView = new EditorView({ state, parent: containerRef.current });

    internalViewRef.current = nextView;

    if (viewRef) viewRef.current = nextView;
  }, [settings, typewriterMode, viewRef]);

  return <div className="cm-editor-container" ref={containerRef} />;
}
