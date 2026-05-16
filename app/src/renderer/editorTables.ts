import { EditorState, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

export interface TableBlock {
  from: number;
  to: number;
  rows: string[][];
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

export function findTableBlocks(state: EditorState): TableBlock[] {
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

    const clearAffordance = () => {
      delete wrapper.dataset.canAddColumnBefore;
      delete wrapper.dataset.canAddColumnAfter;
      delete wrapper.dataset.canAddRowBefore;
      delete wrapper.dataset.canAddRowAfter;
      delete wrapper.dataset.canGrabColumn;
      delete wrapper.dataset.canGrabRow;
    };

    const setAddAffordance = (rowIndex: number, colIndex: number) => {
      activeRow = rowIndex;
      activeCol = colIndex;
      positionControls();
      clearAffordance();

      if (rowIndex === 0) wrapper.dataset.canAddColumnAfter = "true";
      if (rowIndex === rowCount - 1) wrapper.dataset.canAddColumnBefore = "true";
      if (colIndex === 0) wrapper.dataset.canAddRowBefore = "true";
      if (colIndex === colCount - 1) wrapper.dataset.canAddRowAfter = "true";
      if (rowIndex === 0) wrapper.dataset.canGrabColumn = "true";
      if (colIndex === 0) wrapper.dataset.canGrabRow = "true";
    };

    const clearActive = () => {
      wrapper.querySelectorAll(".cm-live-table-active").forEach((element) => {
        element.classList.remove("cm-live-table-active");
      });
      delete wrapper.dataset.activeAxis;
      delete wrapper.dataset.activeRow;
      delete wrapper.dataset.activeCol;
      clearAffordance();
    };

    const clearIfFocusOutside = (relatedTarget: EventTarget | null = null) => {
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
      event: MouseEvent | PointerEvent
    ) => {
      if (wrapper.dataset.dragAxis) return;
      event.preventDefault();
      event.stopPropagation();
      const sourceRow = activeRow;
      const sourceCol = activeCol;
      wrapper.dataset.dragAxis = axis;
      wrapper.dataset.dragSourceRow = String(sourceRow);
      wrapper.dataset.dragSourceCol = String(sourceCol);
      setDropTarget(sourceRow, sourceCol);
      const firstTarget = targetFromPoint(event.clientX, event.clientY);
      if (firstTarget) setDropTarget(firstTarget.row, firstTarget.col);

      const move = (moveEvent: MouseEvent | PointerEvent) => {
        moveEvent.preventDefault();
        const target = targetFromEvent(moveEvent);
        if (target) {
          setDropTarget(target.row, target.col);
        }
      };
      const up = (upEvent: MouseEvent | PointerEvent) => {
        upEvent.preventDefault();
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
        input.addEventListener("blur", (event) => clearIfFocusOutside((event as FocusEvent).relatedTarget));
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
      wrapper.dataset.canGrabColumn = "true";
    });
    columnHandle.addEventListener("pointerdown", (event) => {
      markActive("column", activeRow, activeCol);
      beginCoordinateDrag("column", event);
    });
    columnHandle.addEventListener("mousedown", (event) => {
      if (typeof window.PointerEvent === "function") return;
      markActive("column", activeRow, activeCol);
      beginCoordinateDrag("column", event);
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
      wrapper.dataset.canGrabRow = "true";
    });
    rowHandle.addEventListener("pointerdown", (event) => {
      markActive("row", activeRow, activeCol);
      beginCoordinateDrag("row", event);
    });
    rowHandle.addEventListener("mousedown", (event) => {
      if (typeof window.PointerEvent === "function") return;
      markActive("row", activeRow, activeCol);
      beginCoordinateDrag("row", event);
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
    wrapper.addEventListener("focusout", (event) => {
      clearIfFocusOutside((event as FocusEvent).relatedTarget);
    });
    wrapper.addEventListener("mouseleave", () => {
      if (!wrapper.dataset.dragAxis) clearAffordance();
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

export const livePreviewTableField = StateField.define<DecorationSet>({
  create: (state) => buildTableDecorations(state),
  update: (_decorations, transaction) => buildTableDecorations(transaction.state),
  provide: (field) => EditorView.decorations.from(field)
});
