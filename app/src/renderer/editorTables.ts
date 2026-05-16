import { StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

import { findTableBlocks } from "./editorTableModel";
import { TableWidget } from "./editorTableWidget";

export {
  deleteTableColumn,
  deleteTableRow,
  findTableBlocks,
  formatTable,
  insertTableColumn,
  insertTableRow,
  isTableDivider,
  moveTableColumn,
  moveTableColumnTo,
  moveTableRow,
  moveTableRowTo,
  normalizeTableRows,
  sortTableByColumn,
  splitTableRow,
  tableColumnCount,
  tableRowsFingerprint,
  withTableCellValue,
  type TableBlock
} from "./editorTableModel";

export function buildTableDecorations(state: Parameters<typeof findTableBlocks>[0]): DecorationSet {
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
