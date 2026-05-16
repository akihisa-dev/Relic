import {
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  sortTableByColumn,
  tableColumnCount,
  type TableBlock
} from "./editorTableModel";

type LiveTableClipboard =
  | { type: "row"; cells: string[] }
  | { type: "column"; cells: string[] }
  | null;

let liveTableClipboard: LiveTableClipboard = null;

export function showLiveTableMenu({
  block,
  colIndex,
  event,
  focusCell,
  rowIndex,
  updateRows,
  wrapper
}: {
  block: TableBlock;
  colIndex: number;
  event: MouseEvent;
  focusCell: (rowIndex: number, colIndex: number) => void;
  rowIndex: number;
  updateRows: (rows: string[][]) => void;
  wrapper: HTMLElement;
}): void {
  wrapper.querySelector(".cm-live-table-menu")?.remove();

  const menu = document.createElement("div");
  menu.className = "cm-live-table-menu";
  const rect = wrapper.getBoundingClientRect();
  menu.style.left = `${event.clientX - rect.left}px`;
  menu.style.top = `${event.clientY - rect.top}px`;

  const addItem = (
    label: string,
    action: () => void,
    disabled = false
  ): void => {
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

  const separator = (): void => {
    const hr = document.createElement("div");
    hr.className = "cm-live-table-menu-separator";
    menu.append(hr);
  };

  const colCount = tableColumnCount(block.rows);
  addItem("行を上に追加", () => {
    updateRows(insertTableRow(block.rows, Math.max(1, rowIndex)));
    focusCell(Math.max(1, rowIndex), colIndex);
  }, rowIndex === 0);
  addItem("行を下に追加", () => {
    updateRows(insertTableRow(block.rows, rowIndex + 1));
    focusCell(rowIndex + 1, colIndex);
  });
  addItem("行を削除", () => {
    updateRows(deleteTableRow(block.rows, rowIndex));
    focusCell(Math.max(1, Math.min(rowIndex, block.rows.length - 2)), colIndex);
  }, rowIndex === 0 || block.rows.length <= 2);
  addItem("行を上へ移動", () => {
    updateRows(moveTableRow(block.rows, rowIndex, -1));
    focusCell(rowIndex - 1, colIndex);
  }, rowIndex <= 1);
  addItem("行を下へ移動", () => {
    updateRows(moveTableRow(block.rows, rowIndex, 1));
    focusCell(rowIndex + 1, colIndex);
  }, rowIndex === 0 || rowIndex >= block.rows.length - 1);
  addItem("行をコピー", () => {
    liveTableClipboard = { type: "row", cells: [...block.rows[rowIndex]] };
  });
  addItem("コピーした行を下に貼り付け", () => {
    if (liveTableClipboard?.type !== "row") return;
    const rows = block.rows.map((row) => [...row]);
    rows.splice(rowIndex + 1, 0, Array.from({ length: colCount }, (_, i) => liveTableClipboard?.cells[i] ?? ""));
    updateRows(rows);
    focusCell(rowIndex + 1, colIndex);
  }, liveTableClipboard?.type !== "row");

  separator();

  addItem("列を左に追加", () => {
    updateRows(insertTableColumn(block.rows, colIndex));
    focusCell(rowIndex, colIndex);
  });
  addItem("列を右に追加", () => {
    updateRows(insertTableColumn(block.rows, colIndex + 1));
    focusCell(rowIndex, colIndex + 1);
  });
  addItem("列を削除", () => {
    updateRows(deleteTableColumn(block.rows, colIndex));
    focusCell(rowIndex, Math.max(0, colIndex - 1));
  }, colCount <= 1);
  addItem("列を左へ移動", () => {
    updateRows(moveTableColumn(block.rows, colIndex, -1));
    focusCell(rowIndex, colIndex - 1);
  }, colIndex <= 0);
  addItem("列を右へ移動", () => {
    updateRows(moveTableColumn(block.rows, colIndex, 1));
    focusCell(rowIndex, colIndex + 1);
  }, colIndex >= colCount - 1);
  addItem("列を昇順に並べ替え", () => {
    updateRows(sortTableByColumn(block.rows, colIndex, "asc"));
    focusCell(Math.min(1, block.rows.length - 1), colIndex);
  });
  addItem("列を降順に並べ替え", () => {
    updateRows(sortTableByColumn(block.rows, colIndex, "desc"));
    focusCell(Math.min(1, block.rows.length - 1), colIndex);
  });
  addItem("列をコピー", () => {
    liveTableClipboard = { type: "column", cells: block.rows.map((row) => row[colIndex] ?? "") };
  });
  addItem("コピーした列を右に貼り付け", () => {
    if (liveTableClipboard?.type !== "column") return;
    const rows = block.rows.map((row, rowIndex) => {
      const next = [...row];
      next.splice(colIndex + 1, 0, liveTableClipboard?.cells[rowIndex] ?? "");
      return next;
    });
    updateRows(rows);
    focusCell(rowIndex, colIndex + 1);
  }, liveTableClipboard?.type !== "column");

  wrapper.append(menu);
  const dismiss = (dismissEvent: MouseEvent): void => {
    if (!menu.contains(dismissEvent.target as Node)) {
      menu.remove();
      document.removeEventListener("mousedown", dismiss);
    }
  };
  requestAnimationFrame(() => document.addEventListener("mousedown", dismiss));
}
