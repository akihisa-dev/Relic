import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

interface ListLineMatch {
  content: string;
  indent: string;
  marker: string;
}

const listLinePattern = /^(\s*)((?:[-+*]\s+(?:\[[ xX]\]\s+)?)|(?:\d+\.\s+))(.*)$/;

export function handleMarkdownListEnter(view: EditorView): boolean {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;

  const line = view.state.doc.lineAt(selection.from);
  const match = parseListLine(line.text);
  if (!match) return false;

  if (match.content.trim().length === 0) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: match.indent },
      selection: { anchor: line.from + match.indent.length }
    });
    return true;
  }

  const marker = nextListMarker(match.marker);
  const insert = `\n${match.indent}${marker}`;
  view.dispatch({
    changes: { from: selection.from, insert },
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

function parseListLine(text: string): ListLineMatch | null {
  const match = text.match(listLinePattern);
  if (!match) return null;

  return {
    content: match[3],
    indent: match[1],
    marker: match[2]
  };
}

function nextListMarker(marker: string): string {
  const ordered = marker.match(/^(\d+)\.\s+$/);
  if (ordered) return `${Number(ordered[1]) + 1}. `;

  const checkbox = marker.match(/^([-+*]\s+)\[[ xX]\]\s+$/);
  if (checkbox) return `${checkbox[1]}[ ] `;

  return marker;
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
