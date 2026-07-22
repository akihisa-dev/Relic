import { isolateHistory } from "@codemirror/commands";
import { ChangeSet, EditorSelection, Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { captureEditorScrollAnchor, restoreEditorScrollAnchor } from "./editorScrollAnchor";
import { skipOrderedListRenumberAnnotation } from "./editorListInput";
import { textChangeRange } from "./textChangeRange";

export function replaceExternalEditorContent(view: EditorView, content: string): void {
  const previousContent = view.state.doc.toString();
  const range = textChangeRange(previousContent, content);
  if (!range) return;

  const scrollLeft = view.scrollDOM.scrollLeft;
  const hadFocus = view.hasFocus;
  const scrollAnchor = captureEditorScrollAnchor(view);
  const changes = ChangeSet.of({
    from: range.from,
    insert: content.slice(range.from, range.newTo),
    to: range.oldTo
  }, previousContent.length);
  const fullReplacement = range.from === 0 && range.oldTo === previousContent.length && range.newTo === content.length;
  const mapPosition = (position: number, assoc: -1 | 1): number => fullReplacement
    ? Math.min(position, content.length)
    : changes.mapPos(position, assoc);
  const selection = EditorSelection.create(
    view.state.selection.ranges.map((selectionRange) => {
      if (selectionRange.empty) {
        return EditorSelection.cursor(mapPosition(selectionRange.head, 1));
      }
      const forward = selectionRange.anchor <= selectionRange.head;
      return EditorSelection.range(
        mapPosition(selectionRange.anchor, forward ? -1 : 1),
        mapPosition(selectionRange.head, forward ? 1 : -1)
      );
    }),
    view.state.selection.mainIndex
  );

  view.dispatch({
    annotations: [
      Transaction.addToHistory.of(false),
      isolateHistory.of("full"),
      skipOrderedListRenumberAnnotation.of(true)
    ],
    changes,
    selection
  });
  restoreEditorScrollAnchor(view, {
    ...scrollAnchor,
    pos: fullReplacement
      ? Math.min(scrollAnchor.pos, content.length)
      : changes.mapPos(scrollAnchor.pos, 1)
  }, scrollLeft);
  if (hadFocus) view.focus();
}
