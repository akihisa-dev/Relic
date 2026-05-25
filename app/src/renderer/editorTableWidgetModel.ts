import { tableColumnCount } from "./editorTableModel";

export interface LiveTableSelectedRange {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

export function parsePastedTableCells(text: string): string[][] | null {
  if (!text.includes("\t") && !text.includes("\n") && !text.includes("\r")) return null;

  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.endsWith("\n") ? normalized.slice(0, -1).split("\n") : normalized.split("\n");
  const rows = lines.map((line) => line.split("\t"));

  if (rows.length === 1 && rows[0].length === 1) return null;

  return rows;
}

export function withPastedTableCells(
  rows: string[][],
  startRow: number,
  startCol: number,
  pastedRows: string[][]
): string[][] {
  const nextRows = rows.map((row) => [...row]);
  const colCount = tableColumnCount(nextRows);

  for (let rowOffset = 0; rowOffset < pastedRows.length; rowOffset += 1) {
    const targetRow = startRow + rowOffset;
    while (targetRow >= nextRows.length) {
      nextRows.push(Array.from({ length: colCount }, () => ""));
    }

    for (let colOffset = 0; colOffset < pastedRows[rowOffset].length; colOffset += 1) {
      nextRows[targetRow][startCol + colOffset] = pastedRows[rowOffset][colOffset];
    }
  }

  return nextRows;
}

export function selectedRangeFromDataset(value?: string): LiveTableSelectedRange | null {
  if (!value) return null;

  const parts = value.split(":").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return null;

  const [fromRow, fromCol, toRow, toCol] = parts;
  return { fromCol, fromRow, toCol, toRow };
}

export function selectedRangeText(rows: string[][], range: LiveTableSelectedRange): string {
  return Array.from({ length: range.toRow - range.fromRow + 1 }, (_, rowOffset) => {
    const row = rows[range.fromRow + rowOffset] ?? [];
    return Array.from({ length: range.toCol - range.fromCol + 1 }, (_, colOffset) => (
      row[range.fromCol + colOffset] ?? ""
    )).join("\t");
  }).join("\n");
}

export function clearSelectedRange(rows: string[][], range: LiveTableSelectedRange): string[][] {
  return rows.map((row, rowIndex) => {
    if (rowIndex < range.fromRow || rowIndex > range.toRow) return [...row];

    const next = [...row];
    for (let colIndex = range.fromCol; colIndex <= range.toCol; colIndex += 1) {
      next[colIndex] = "";
    }
    return next;
  });
}

export function canMoveHorizontallyWithArrow({
  key,
  selectionEnd,
  selectionStart,
  value
}: {
  key: "ArrowLeft" | "ArrowRight";
  selectionEnd: number | null;
  selectionStart: number | null;
  value: string;
}): boolean {
  if (selectionStart === null || selectionEnd === null) return value.length === 0;
  if (selectionStart !== selectionEnd) return false;

  return key === "ArrowLeft"
    ? selectionStart === 0
    : selectionEnd === value.length;
}
