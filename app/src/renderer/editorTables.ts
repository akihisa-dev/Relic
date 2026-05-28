import { StateField } from "@codemirror/state";
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

export function createLivePreviewTableField(t: Translator): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: (state) => buildTableDecorations(state, t),
    update: (_decorations, transaction) => buildTableDecorations(transaction.state, t),
    provide: (field) => EditorView.decorations.from(field)
  });
}
