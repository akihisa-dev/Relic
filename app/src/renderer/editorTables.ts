import { syntaxTree } from "@codemirror/language";
import { ChangeSet, StateEffect, StateField, Transaction, type EditorState, type Text } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

import { findTableBlocks, tableColumnCount } from "./editorTableModel";
import { TableWidget } from "./editorTableWidget";
import { editorHeavyUpdateDelay } from "./editorComplexity";
import { scheduleEditorFrameEffect } from "./editorFrameUpdates";
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

export const livePreviewTableMaxRows = 120;
export const livePreviewTableMaxCells = 720;

function shouldRenderLivePreviewTable(rows: string[][]): boolean {
  return rows.length <= livePreviewTableMaxRows && rows.length * tableColumnCount(rows) <= livePreviewTableMaxCells;
}

export function buildTableDecorations(state: Parameters<typeof findTableBlocks>[0], t: Translator): DecorationSet {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];

  for (const block of findTableBlocks(state)) {
    if (!shouldRenderLivePreviewTable(block.rows)) continue;

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

interface TablePreviewState {
  decorations: DecorationSet;
  dirty: boolean;
  visibleRanges: Array<{ from: number; to: number }>;
}

/** @internal Test-only observer for decoration rebuild quality gates. */
export interface __TableDecorationTestHooks {
  onRebuild?: (reason: "create" | "visibleRanges" | "docChanged") => void;
}

const tablePreviewVisibleRangesEffect = StateEffect.define<Array<{ from: number; to: number }>>();
const tablePreviewRefreshEffect = StateEffect.define<null>();

/** @internal Test-only access to drive visible range rebuilds without a browser viewport. */
export const __tablePreviewVisibleRangesEffectForTests = tablePreviewVisibleRangesEffect;
/** @internal Test-only access to complete a deferred structural rebuild. */
export const __tablePreviewRefreshEffectForTests = tablePreviewRefreshEffect;

function initialVisibleRanges(state: EditorState): Array<{ from: number; to: number }> {
  return state.doc.length === 0 ? [] : [{ from: 0, to: Math.min(state.doc.length, 1) }];
}

function visibleRangesForView(view: EditorView): Array<{ from: number; to: number }> {
  return view.visibleRanges.map((range) => ({ from: range.from, to: range.to }));
}

function visibleRangeKey(ranges: readonly { from: number; to: number }[]): string {
  return ranges.map((range) => `${range.from}:${range.to}`).join("|");
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

function buildSyntaxTableDecorations(
  state: EditorState,
  t: Translator,
  visibleRanges: Array<{ from: number; to: number }>
): TablePreviewState {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const seen = new Set<string>();
  const tree = syntaxTree(state);

  for (const visibleRange of visibleRanges) {
    tree.iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: (node) => {
        if (node.name !== "Table") return;

        const key = `${node.from}:${node.to}`;
        if (seen.has(key)) return;
        seen.add(key);

        const rows = tableRowsFromRange(state, node.from, node.to);

        if (!shouldRenderLivePreviewTable(rows)) return;

        ranges.push({
          from: node.from,
          to: node.to,
          deco: Decoration.replace({
            block: true,
            widget: new TableWidget({
              from: node.from,
              isAtDocumentEnd: node.to === state.doc.length,
              to: node.to,
              rows
            }, t)
          })
        });
      }
    });
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return {
    decorations: Decoration.set(
      ranges.map(({ from, to, deco }) => deco.range(from, to)),
      true
    ),
    dirty: false,
    visibleRanges
  };
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

function mapVisibleRanges(changes: ChangeSet, ranges: Array<{ from: number; to: number }>): Array<{ from: number; to: number }> {
  return ranges.map((range) => ({
    from: changes.mapPos(range.from),
    to: changes.mapPos(range.to)
  }));
}

function visibleRangeEffect(transaction: Transaction): Array<{ from: number; to: number }> | null {
  for (const effect of transaction.effects) {
    if (effect.is(tablePreviewVisibleRangesEffect)) return effect.value;
  }

  return null;
}

function requestsTableRefresh(transaction: Transaction): boolean {
  return transaction.effects.some((effect) => effect.is(tablePreviewRefreshEffect));
}

export function createLivePreviewTableField(t: Translator, testHooks?: __TableDecorationTestHooks) {
  const field = StateField.define<TablePreviewState>({
    create: (state) => {
      testHooks?.onRebuild?.("create");
      return buildSyntaxTableDecorations(state, t, initialVisibleRanges(state));
    },
    update: (preview, transaction) => {
      const nextVisibleRanges = visibleRangeEffect(transaction);
      if (nextVisibleRanges) {
        testHooks?.onRebuild?.("visibleRanges");
        return buildSyntaxTableDecorations(transaction.state, t, nextVisibleRanges);
      }

      if (preview.dirty && requestsTableRefresh(transaction)) {
        testHooks?.onRebuild?.("docChanged");
        return buildSyntaxTableDecorations(transaction.state, t, preview.visibleRanges);
      }

      if (transaction.docChanged) {
        if (transaction.annotation(Transaction.userEvent) === "input.table") {
          testHooks?.onRebuild?.("docChanged");
          return buildSyntaxTableDecorations(transaction.state, t, preview.visibleRanges);
        }
        if (canMapTableDecorations(transaction, preview.decorations)) {
          return {
            decorations: preview.decorations.map(transaction.changes),
            dirty: preview.dirty,
            visibleRanges: mapVisibleRanges(transaction.changes, preview.visibleRanges)
          };
        }

        return {
          decorations: preview.decorations.map(transaction.changes),
          dirty: true,
          visibleRanges: mapVisibleRanges(transaction.changes, preview.visibleRanges)
        };
      }

      return preview;
    },
    provide: (field) => EditorView.decorations.from(field, (preview) => preview.decorations)
  });

  const viewportSync = ViewPlugin.fromClass(
    class {
      private visibleRangesKey = "";

      constructor(view: EditorView) {
        this.scheduleVisibleRangeSync(view);
      }

      update(update: ViewUpdate): void {
        if (update.viewportChanged || update.docChanged) this.scheduleVisibleRangeSync(update.view);
        if (update.docChanged) {
          scheduleEditorFrameEffect(
            update.view,
            "table-refresh",
            () => tablePreviewRefreshEffect.of(null),
            editorHeavyUpdateDelay(update.state.doc, update.view.visibleRanges)
          );
        }
      }

      private scheduleVisibleRangeSync(view: EditorView): void {
        const visibleRanges = visibleRangesForView(view);
        const nextKey = visibleRangeKey(visibleRanges);
        if (nextKey === this.visibleRangesKey) return;

        this.visibleRangesKey = nextKey;
        scheduleEditorFrameEffect(
          view,
          "table-visible-ranges",
          () => tablePreviewVisibleRangesEffect.of(visibleRangesForView(view)),
          editorHeavyUpdateDelay(view.state.doc, visibleRanges)
        );
      }
    }
  );

  return [field, viewportSync];
}
