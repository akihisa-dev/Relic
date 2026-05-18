import { EditorView } from "@codemirror/view";

import {
  formatTable,
  insertTableColumn,
  insertTableRow,
  type TableBlock
} from "./editorTableModel";
import type { Translator } from "./i18n";

export type TableEdgeAddAxis = "column-before" | "column-after" | "row-before" | "row-after";

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
    if (input instanceof HTMLInputElement) {
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
  button.textContent = "+";
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
