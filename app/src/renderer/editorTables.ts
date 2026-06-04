import { syntaxTree } from "@codemirror/language";
import { ChangeSet, StateField, type EditorState, type Text, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import { findTableBlocks } from "./editorTableModel";
import { TableWidget } from "./editorTableWidget";
import type { Translator } from "./i18nModel";

export {
  deleteTableColumn,
  deleteTableRow,
  findTableBlocks,
  formatTable,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableColumnTo,
  moveTableRow,
  moveTableRowTo,
  sortTableByColumn,
  tableColumnCount,
  tableRowsFingerprint,
  withTableCellValue,
  type TableBlock
} from "./editorTableModel";

export function buildTableDecorations(state: Parameters<typeof findTableBlocks>[0], t: Translator): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];

  for (const block of findTableBlocks(state)) {
    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({ widget: new TableWidget(block, t), block: true })
    });
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function tableRowsFromRange(state: EditorState, from: number, to: number): string[][] {
  const rows: string[][] = [];
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(Math.max(from, to - 1)).number;

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (!/\|/.test(line.text) || /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.text)) continue;
    rows.push(splitTableRow(line.text));
  }

  return rows;
}

function buildSyntaxTableDecorations(state: EditorState, t: Translator): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const seen = new Set<string>();

  syntaxTree(state).iterate({
    from: 0,
    to: state.doc.length,
    enter: (node) => {
      if (node.name !== "Table") return;

      const key = `${node.from}:${node.to}`;
      if (seen.has(key)) return;
      seen.add(key);

      ranges.push({
        from: node.from,
        to: node.to,
        deco: Decoration.replace({
          block: true,
          widget: new TableWidget({
            from: node.from,
            to: node.to,
            rows: tableRowsFromRange(state, node.from, node.to)
          }, t)
        })
      });
    }
  });

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}

function changedTextIncludes(changes: ChangeSet, doc: Text, pattern: RegExp): boolean {
  let includes = false;

  changes.iterChanges((_fromA, _toA, fromB, toB) => {
    if (includes || fromB === toB) return;
    includes = pattern.test(doc.sliceString(fromB, toB));
  });

  return includes;
}

function changesTouchDecorations(changes: ChangeSet, decorations: DecorationSet): boolean {
  let touches = false;

  changes.iterChangedRanges((fromA, toA) => {
    if (touches) return;
    decorations.between(Math.max(0, fromA - 1), Math.max(fromA + 1, toA), () => {
      touches = true;
    });
  });

  return touches;
}

function canMapTableDecorations(transaction: Transaction, decorations: DecorationSet): boolean {
  if (!transaction.docChanged) return true;
  if (changesTouchDecorations(transaction.changes, decorations)) return false;
  return !changedTextIncludes(transaction.changes, transaction.state.doc, /[|:\-\n]/);
}

export function createLivePreviewTableField(t: Translator) {
  return StateField.define<DecorationSet>({
    create: (state) => buildSyntaxTableDecorations(state, t),
    update: (decorations, transaction) => (
      transaction.docChanged
        ? canMapTableDecorations(transaction, decorations)
          ? decorations.map(transaction.changes)
          : buildSyntaxTableDecorations(transaction.state, t)
        : decorations
    ),
    provide: (field) => EditorView.decorations.from(field)
  });
}
