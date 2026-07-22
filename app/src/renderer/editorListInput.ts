import { isolateHistory } from "@codemirror/commands";
import { Annotation, EditorSelection, EditorState, Transaction, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import {
  continueListMarkersInPastedText,
  lastOrderedMarkerNumber,
  nextListMarker,
  orderedListRenumberChangesNear,
  orderedMarkerNumber,
  parseListLine,
  renumberFollowingOrderedItems,
  transactionDeletesText
} from "./editorListModel";
import { isPositionInFencedCodeBlock } from "./markdownCodeBlockRanges";
export const skipOrderedListRenumberAnnotation = Annotation.define<boolean>();

export function createOrderedListRenumberExtension(): Extension {
  return EditorState.transactionFilter.of((transaction) => {
    if (
      !transaction.docChanged ||
      transaction.annotation(skipOrderedListRenumberAnnotation) ||
      !transactionDeletesText(transaction.changes)
    ) return transaction;

    const changes = orderedListRenumberChangesNear(transaction.newDoc, transaction.changes);
    return changes.length === 0
      ? transaction
      : [transaction, { changes, sequential: true }];
  });
}

export function handleMarkdownListEnter(view: EditorView): boolean {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  if (isPositionInFencedCodeBlock(view.state, selection.from)) return false;

  const line = view.state.doc.lineAt(selection.from);
  const match = parseListLine(line.text);
  if (!match) return false;

  if (match.content.trim().length === 0) {
    view.dispatch({
      annotations: isolateHistory.of("full"),
      changes: { from: line.from, to: line.to, insert: `${match.prefix}${match.indent}` },
      selection: { anchor: line.from + match.prefix.length + match.indent.length }
    });
    return true;
  }

  const marker = nextListMarker(match.marker);
  const insert = `\n${match.prefix}${match.indent}${marker}`;
  const changes = [{ from: selection.from, insert }];
  const ordered = orderedMarkerNumber(marker);
  if (ordered !== null) {
    changes.push(...renumberFollowingOrderedItems(
      view.state.doc,
      line.number + 1,
      match.prefix,
      match.indent,
      ordered + 1
    ));
  }
  view.dispatch({
    annotations: isolateHistory.of("full"),
    changes,
    selection: { anchor: selection.from + insert.length }
  });
  return true;
}

export function handleMarkdownListBackspace(view: EditorView): boolean {
  const selection = view.state.selection.main;
  if (!selection.empty || isPositionInFencedCodeBlock(view.state, selection.from)) return false;

  const line = view.state.doc.lineAt(selection.from);
  const match = parseListLine(line.text);
  if (!match || match.content.trim().length > 0) return false;

  const markerFrom = line.from + match.prefix.length + match.indent.length;
  const markerTo = markerFrom + match.marker.length;
  if (selection.from !== markerTo) return false;

  if (match.indent.length > 0) {
    const removable = match.indent.endsWith("\t") ? 1 : Math.min(2, match.indent.length);
    view.dispatch({
      annotations: isolateHistory.of("full"),
      changes: { from: markerFrom - removable, to: markerFrom },
      selection: { anchor: markerTo - removable }
    });
    return true;
  }

  view.dispatch({
    annotations: isolateHistory.of("full"),
    changes: { from: markerFrom, to: markerTo },
    selection: { anchor: markerFrom }
  });
  return true;
}

export function handleMarkdownListPaste(view: EditorView, text: string): boolean {
  const { state } = view;
  if (!/\r|\n/.test(text) || state.selection.ranges.length !== 1) return false;

  const selection = state.selection.main;
  if (isPositionInFencedCodeBlock(state, selection.from) || isPositionInFencedCodeBlock(state, selection.to)) {
    return false;
  }

  const fromLine = state.doc.lineAt(selection.from);
  const toLine = state.doc.lineAt(selection.to);
  if (fromLine.number !== toLine.number) return false;

  const match = parseListLine(fromLine.text);
  if (!match) return false;

  const insert = continueListMarkersInPastedText(text, match);
  const changes = [{ from: selection.from, to: selection.to, insert }];
  const finalOrdered = lastOrderedMarkerNumber(insert, match);
  if (finalOrdered !== null) {
    changes.push(...renumberFollowingOrderedItems(
      state.doc,
      fromLine.number + 1,
      match.prefix,
      match.indent,
      finalOrdered + 1
    ));
  }
  view.dispatch({
    annotations: [Transaction.userEvent.of("input.paste"), isolateHistory.of("full")],
    changes,
    scrollIntoView: true,
    selection: { anchor: selection.from + insert.length }
  });
  return true;
}

export function indentMarkdownListSelection(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const selectedLineNumbers = selectedListLineNumbers(state.selection.ranges, state.doc);
  const changes: { from: number; insert?: string; to?: number }[] = [];
  const canIndentPlainLines = state.selection.ranges.some((range) => !range.empty);
  let touched = false;

  for (const lineNumber of selectedLineNumbers) {
    const line = state.doc.line(lineNumber);
    if (line.text.trim() === "") continue;
    if (!canIndentPlainLines && !parseListLine(line.text)) continue;

    if (direction === 1) {
      changes.push({ from: line.from, insert: "  " });
      touched = true;
      continue;
    }

    const removable = line.text.startsWith("  ") ? 2 : line.text.startsWith("\t") ? 1 : 0;
    if (removable > 0) {
      changes.push({ from: line.from, to: line.from + removable, insert: "" });
      touched = true;
    }
  }

  if (!touched) return false;

  view.dispatch({
    annotations: isolateHistory.of("full"),
    changes,
    selection: state.selection.map(state.changes(changes))
  });
  return true;
}

export function moveSelectedLines(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const { firstLine, lastLine } = selectedLineBounds(state.selection.ranges, state.doc);

  if (direction === -1) {
    if (firstLine.number === 1) return false;

    const previousLine = state.doc.line(firstLine.number - 1);
    const blockText = state.sliceDoc(firstLine.from, lastLine.to);
    const insert = `${blockText}\n${previousLine.text}`;

    view.dispatch({
      annotations: isolateHistory.of("full"),
      changes: { from: previousLine.from, to: lastLine.to, insert },
      selection: EditorSelection.range(previousLine.from, previousLine.from + blockText.length)
    });
    return true;
  }

  if (lastLine.number === state.doc.lines) return false;

  const nextLine = state.doc.line(lastLine.number + 1);
  const blockText = state.sliceDoc(firstLine.from, lastLine.to);
  const insert = `${nextLine.text}\n${blockText}`;
  const nextSelectionFrom = firstLine.from + nextLine.text.length + 1;

  view.dispatch({
    annotations: isolateHistory.of("full"),
    changes: { from: firstLine.from, to: nextLine.to, insert },
    selection: EditorSelection.range(nextSelectionFrom, nextSelectionFrom + blockText.length)
  });
  return true;
}

export function isListInputEvent(event: KeyboardEvent, view: EditorView): boolean {
  if (event.isComposing || event.keyCode === 229 || view.composing || view.compositionStarted) return false;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest(".cm-live-table")) return false;
  return true;
}

function selectedListLineNumbers(
  ranges: readonly { from: number; to: number }[],
  doc: EditorView["state"]["doc"]
): number[] {
  const lineNumbers = new Set<number>();

  for (const range of ranges) {
    const fromLine = doc.lineAt(range.from);
    const toLine = doc.lineAt(range.to === range.from ? range.to : Math.max(range.from, range.to - 1));

    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber += 1) {
      lineNumbers.add(lineNumber);
    }
  }

  return Array.from(lineNumbers).toSorted((left, right) => left - right);
}

function selectedLineBounds(
  ranges: readonly { from: number; to: number }[],
  doc: EditorView["state"]["doc"]
): {
  firstLine: ReturnType<EditorView["state"]["doc"]["lineAt"]>;
  lastLine: ReturnType<EditorView["state"]["doc"]["lineAt"]>;
} {
  let from = doc.length;
  let to = 0;

  for (const range of ranges) {
    from = Math.min(from, range.from);
    to = Math.max(to, range.to === range.from ? range.to : Math.max(range.from, range.to - 1));
  }

  return {
    firstLine: doc.lineAt(from),
    lastLine: doc.lineAt(to)
  };
}
