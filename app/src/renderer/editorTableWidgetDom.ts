import { EditorView } from "@codemirror/view";

import {
  deleteTableColumn,
  deleteTableRow,
  formatTable,
  insertTableColumn,
  insertTableRow,
  tableColumnCount,
  type TableBlock
} from "./editorTableModel";
import type { Translator } from "./i18nModel";

export type TableEdgeAddAxis = "column-before" | "column-after" | "row-before" | "row-after";
export type TableDeleteAxis = "column" | "row";

function appendTableAddIcon(button: HTMLButtonElement): void {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("height", "16");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");

  const horizontal = document.createElementNS(namespace, "path");
  horizontal.setAttribute("d", "M5 12h14");
  const vertical = document.createElementNS(namespace, "path");
  vertical.setAttribute("d", "M12 5v14");
  svg.append(horizontal, vertical);
  button.append(svg);
}

export function findTableWidgetView(element: HTMLElement): EditorView | null {
  const editor = element.closest(".cm-editor");
  return editor instanceof HTMLElement ? EditorView.findFromDOM(editor) : EditorView.findFromDOM(element);
}

export function focusTableWidgetCell(anchor: HTMLElement, rowIndex: number, colIndex: number): void {
  const searchRoot = anchor.closest(".cm-editor") ?? document;
  requestAnimationFrame(() => {
    const input = searchRoot.querySelector(
      `.cm-live-table-cell-input[data-row="${rowIndex}"][data-col="${colIndex}"]`
    );
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.focus();
      input.select();
    }
  });
}

export function updateTableWidgetRows(view: EditorView, block: TableBlock, rows: string[][]): void {
  view.dispatch({
    changes: {
      from: block.from,
      to: block.to,
      insert: formatTable(rows)
    }
  });
}

export function createTableEdgeAddButton({
  axis,
  block,
  getFocusIndex,
  getInsertIndex,
  t
}: {
  axis: TableEdgeAddAxis;
  block: TableBlock;
  getFocusIndex: () => number;
  getInsertIndex: () => number;
  t: Translator;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cm-live-table-add cm-live-table-add--${axis}`;
  appendTableAddIcon(button);
  button.title = axis.startsWith("column")
    ? axis.endsWith("before") ? t("editor.tableAddColumnLeft") : t("editor.tableAddColumnRight")
    : axis.endsWith("before") ? t("editor.tableAddRowAbove") : t("editor.tableAddRowBelow");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const view = findTableWidgetView(button);
    if (!view) return;
    const index = getInsertIndex();
    const isColumn = axis.startsWith("column");
    const rows = isColumn ? insertTableColumn(block.rows, index) : insertTableRow(block.rows, index);
    updateTableWidgetRows(view, block, rows);
    focusTableWidgetCell(
      button,
      isColumn ? Math.min(getFocusIndex(), block.rows.length - 1) : index,
      isColumn ? index : getFocusIndex()
    );
  });
  return button;
}

export function createTableDeleteButton({
  axis,
  block,
  getColIndex,
  getRowIndex,
  t
}: {
  axis: TableDeleteAxis;
  block: TableBlock;
  getColIndex: () => number;
  getRowIndex: () => number;
  t: Translator;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cm-live-table-delete cm-live-table-delete--${axis}`;
  button.textContent = "-";
  button.title = axis === "column" ? t("editor.tableDeleteColumn") : t("editor.tableDeleteRow");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const view = findTableWidgetView(button);
    if (!view) return;

    const colIndex = getColIndex();
    const rowIndex = getRowIndex();
    if (axis === "column") {
      if (tableColumnCount(block.rows) <= 1) return;
      updateTableWidgetRows(view, block, deleteTableColumn(block.rows, colIndex));
      focusTableWidgetCell(button, rowIndex, Math.max(0, colIndex - 1));
      return;
    }

    if (rowIndex === 0 || block.rows.length <= 2) return;
    updateTableWidgetRows(view, block, deleteTableRow(block.rows, rowIndex));
    focusTableWidgetCell(button, Math.max(1, Math.min(rowIndex, block.rows.length - 2)), colIndex);
  });
  return button;
}
