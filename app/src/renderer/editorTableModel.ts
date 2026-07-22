import type { EditorState } from "@codemirror/state";
import { textChangeRange } from "./textChangeRange";

export interface TableBlock {
  from: number;
  isAtDocumentEnd?: boolean;
  to: number;
  rows: string[][];
}

export function minimalTableMarkdownChange(
  block: Pick<TableBlock, "from">,
  currentMarkdown: string,
  nextMarkdown: string
): { from: number; insert: string; to: number } | null {
  const range = textChangeRange(currentMarkdown, nextMarkdown);
  if (!range) return null;

  return {
    from: block.from + range.from,
    insert: nextMarkdown.slice(range.from, range.newTo),
    to: block.from + range.oldTo
  };
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

export function tableColumnCount(rows: string[][]): number {
  return Math.max(...rows.map((row) => row.length), 1);
}

function normalizeTableRows(rows: string[][]): string[][] {
  const colCount = tableColumnCount(rows);
  return rows.map((row) => Array.from({ length: colCount }, (_, index) => row[index] ?? ""));
}

export function formatTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  const normalized = normalizeTableRows(rows);
  const colCount = tableColumnCount(normalized);
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

    if (!/\|/.test(headerLine.text) || !isTableDivider(dividerLine.text)) {
      lineNumber += 1;
      continue;
    }

    const rows = [splitTableRow(headerLine.text)];
    let endLine = dividerLine;
    let cursor = lineNumber + 2;

    while (cursor <= doc.lines) {
      const rowLine = doc.line(cursor);
      if (!/\|/.test(rowLine.text) || rowLine.text.trim() === "") break;
      rows.push(splitTableRow(rowLine.text));
      endLine = rowLine;
      cursor += 1;
    }

    blocks.push({ from: headerLine.from, isAtDocumentEnd: endLine.to === doc.length, to: endLine.to, rows });
    lineNumber = cursor;
  }

  return blocks;
}

export function tableRowsFingerprint(rows: string[][]): string {
  return rows.map((row) => row.join("\u0000")).join("\u0001");
}

function cloneRows(rows: string[][]): string[][] {
  return rows.map((row) => [...row]);
}

function isValidRowIndex(rows: string[][], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < rows.length;
}

function isValidColumnIndex(rows: string[][], index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < tableColumnCount(rows);
}

export function withTableCellValue(rows: string[][], rowIndex: number, colIndex: number, value: string): string[][] {
  if (!isValidRowIndex(rows, rowIndex) || colIndex < 0) return cloneRows(rows);

  return rows.map((row, currentRowIndex) => {
    const next = [...row];
    if (currentRowIndex === rowIndex) next[colIndex] = value;
    return next;
  });
}

export function insertTableRow(rows: string[][], index: number): string[][] {
  if (!Number.isInteger(index) || index < 0 || index > rows.length) return cloneRows(rows);

  const colCount = tableColumnCount(rows);
  const nextRows = cloneRows(rows);
  nextRows.splice(index, 0, Array.from({ length: colCount }, () => ""));
  return nextRows;
}

export function deleteTableRow(rows: string[][], index: number): string[][] {
  if (!isValidRowIndex(rows, index)) return cloneRows(rows);
  return rows.filter((_, rowIndex) => rowIndex !== index);
}

export function insertTableColumn(rows: string[][], index: number): string[][] {
  const colCount = tableColumnCount(rows);
  if (!Number.isInteger(index) || index < 0 || index > colCount) return cloneRows(rows);

  return rows.map((row) => {
    const next = [...row];
    next.splice(index, 0, "");
    return next;
  });
}

export function deleteTableColumn(rows: string[][], index: number): string[][] {
  if (!isValidColumnIndex(rows, index)) return cloneRows(rows);
  return rows.map((row) => row.filter((_, colIndex) => colIndex !== index));
}

export function moveTableRow(rows: string[][], index: number, direction: -1 | 1): string[][] {
  const nextRows = cloneRows(rows);
  const target = index + direction;
  if (index <= 0 || target <= 0 || target >= nextRows.length) return nextRows;
  [nextRows[index], nextRows[target]] = [nextRows[target], nextRows[index]];
  return nextRows;
}

export function moveTableRowTo(rows: string[][], from: number, to: number): string[][] {
  const nextRows = cloneRows(rows);
  if (from <= 0 || to <= 0 || from >= nextRows.length || to >= nextRows.length) return nextRows;
  const [row] = nextRows.splice(from, 1);
  nextRows.splice(to, 0, row);
  return nextRows;
}

export function moveTableColumn(rows: string[][], index: number, direction: -1 | 1): string[][] {
  return rows.map((row) => {
    const next = [...row];
    const target = index + direction;
    if (target < 0 || target >= next.length) return next;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
}

export function moveTableColumnTo(rows: string[][], from: number, to: number): string[][] {
  return rows.map((row) => {
    const next = [...row];
    if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
    const [cell] = next.splice(from, 1);
    next.splice(to, 0, cell);
    return next;
  });
}

export function sortTableByColumn(rows: string[][], index: number, direction: "asc" | "desc"): string[][] {
  if (rows.length === 0) return [];

  const [header, ...body] = cloneRows(rows);
  body.sort((left, right) => {
    const result = (left[index] ?? "").localeCompare(right[index] ?? "", undefined, {
      numeric: true,
      sensitivity: "base"
    });
    return direction === "asc" ? result : -result;
  });
  return [header, ...body];
}
