import { isolateHistory } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { ChangeSpec, EditorState, SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { rangeIntersectsFencedCodeBlock } from "./markdownCodeBlockRanges";

export type BlockIdFactory = () => string;

export { insertAtLineStart, insertListAtSelectedLines } from "./toolbarLineCommands";
export type { HeadingLevel, ListFormatKind } from "./toolbarLineCommands";
export { findToolbarTargetView } from "./toolbarTargetView";

interface ToolbarRangeChange {
  changes: ChangeSpec;
  range: SelectionRange;
}

export function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    if (rangeIntersectsFencedCodeBlock(state, range.from, range.to)) return preserveRange(range);

    const selectedToggle = toggleSelectedWrapper(state, range.from, range.to, before, after);
    if (selectedToggle) return selectedToggle;

    const cursorToggle = range.empty ? toggleCursorWrapper(state, range.from, before, after) : null;
    if (cursorToggle) return cursorToggle;

    const selected = state.sliceDoc(range.from, range.to);
    const text = selected.length > 0 ? selected : placeholder;

    return {
      changes: { from: range.from, to: range.to, insert: `${before}${text}${after}` },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + text.length
      )
    };
  });

  view.dispatch({ ...changes, annotations: isolateHistory.of("full") });
  view.focus();
}

export function insertBlock(view: EditorView, text: string): void {
  const { state } = view;
  const pos = state.selection.main.from;
  const line = state.doc.lineAt(pos);
  const prefix = line.from > 0 ? "\n" : "";

  view.dispatch({
    annotations: isolateHistory.of("full"),
    changes: { from: line.to, insert: `${prefix}\n${text}\n` },
    selection: { anchor: line.to + prefix.length + 1 + text.length + 1 }
  });
  view.focus();
}

export function insertCodeBlock(view: EditorView): void {
  const { state } = view;

  if (state.selection.ranges.every((range) => range.empty)) {
    const changes = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.from);
      const prefix = line.from > 0 ? "\n" : "";
      const insert = `${prefix}\n\`\`\`\n\n\`\`\`\n`;
      const cursor = line.to + prefix.length + "\n```\n".length;

      return {
        changes: { from: line.to, insert },
        range: EditorSelection.cursor(cursor)
      };
    });

    view.dispatch({ ...changes, annotations: isolateHistory.of("full") });
    view.focus();
    return;
  }

  const before = "```\n";
  const after = "\n```";
  const changes = state.changeByRange((range) => {
    const selectedToggle = toggleSelectedWrapper(state, range.from, range.to, before, after);
    if (selectedToggle) return selectedToggle;

    const selected = state.sliceDoc(range.from, range.to);

    return {
      changes: { from: range.from, to: range.to, insert: `${before}${selected}${after}` },
      range: EditorSelection.range(
        range.from + before.length,
        range.from + before.length + selected.length
      )
    };
  });

  view.dispatch({ ...changes, annotations: isolateHistory.of("full") });
  view.focus();
}

export function insertMarkdownLink(view: EditorView, url: string, placeholderLinkText: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    if (rangeIntersectsFencedCodeBlock(state, range.from, range.to)) return preserveRange(range);

    const existingEdit = editMarkdownLink(state, range.from, range.to, url);
    if (existingEdit) return existingEdit;

    const selectedToggle = toggleMarkdownLink(state, range.from, range.to);
    if (selectedToggle) return selectedToggle;

    const selected = state.sliceDoc(range.from, range.to);
    const text = selected || placeholderLinkText;

    return {
      changes: { from: range.from, to: range.to, insert: `[${text}](${url})` },
      range: EditorSelection.range(range.from + 1, range.from + 1 + text.length)
    };
  });

  view.dispatch({ ...changes, annotations: isolateHistory.of("full") });
  view.focus();
}

export function insertInternalLink(view: EditorView): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    if (rangeIntersectsFencedCodeBlock(state, range.from, range.to)) return preserveRange(range);

    const selectedToggle = toggleSelectedWrapper(state, range.from, range.to, "[[", "]]");
    if (selectedToggle) return selectedToggle;

    const cursorToggle = range.empty ? toggleCursorWrapper(state, range.from, "[[", "]]") : null;
    if (cursorToggle) return cursorToggle;

    const selected = state.sliceDoc(range.from, range.to);
    const text = selected.length > 0 ? selected : "";

    return {
      changes: { from: range.from, to: range.to, insert: `[[${text}]]` },
      range: EditorSelection.range(range.from + 2, range.from + 2 + text.length)
    };
  });

  view.dispatch({ ...changes, annotations: isolateHistory.of("full") });
  view.focus();
}

export function insertBlockIds(view: EditorView, createId: BlockIdFactory = () => Math.random().toString(36).slice(2, 8)): void {
  const { state } = view;
  const changes = findParagraphEndLineNumbers(state)
    .map((lineNumber) => {
      const line = state.doc.line(lineNumber);
      if (hasBlockId(line.text)) return null;

      return {
        from: line.to,
        insert: `${line.text.trim().length > 0 ? " " : ""}^${createId()}`
      };
    })
    .filter((change): change is { from: number; insert: string } => change !== null);

  if (changes.length > 0) {
    view.dispatch({ annotations: isolateHistory.of("full"), changes });
  }

  view.focus();
}

function preserveRange(range: SelectionRange): ToolbarRangeChange {
  return {
    changes: [],
    range
  };
}

function toggleSelectedWrapper(
  state: EditorState,
  from: number,
  to: number,
  before: string,
  after: string
): ToolbarRangeChange | null {
  if (from === to) return null;

  const beforeFrom = from - before.length;
  const afterTo = to + after.length;
  if (
    beforeFrom < 0
    || afterTo > state.doc.length
    || state.sliceDoc(beforeFrom, from) !== before
    || state.sliceDoc(to, afterTo) !== after
    || !isStandaloneInlineBoundary(state, beforeFrom, before)
    || !isStandaloneInlineBoundary(state, to, after)
  ) {
    return null;
  }

  return {
    changes: [
      { from: to, to: afterTo, insert: "" },
      { from: beforeFrom, to: from, insert: "" }
    ],
    range: EditorSelection.range(beforeFrom, beforeFrom + (to - from))
  };
}

function toggleCursorWrapper(
  state: EditorState,
  position: number,
  before: string,
  after: string
): ToolbarRangeChange | null {
  const line = state.doc.lineAt(position);
  const offset = position - line.from;
  const start = findOpeningMarker(line.text, offset, before, after);
  if (start === null) return null;

  const contentStart = start + before.length;
  const end = line.text.indexOf(after, Math.max(contentStart, offset));
  if (end < contentStart) return null;

  return {
    changes: [
      { from: line.from + end, to: line.from + end + after.length, insert: "" },
      { from: line.from + start, to: line.from + contentStart, insert: "" }
    ],
    range: EditorSelection.range(line.from + contentStart - before.length, line.from + end - before.length)
  };
}

function findOpeningMarker(text: string, offset: number, before: string, after: string): number | null {
  for (let index = Math.min(offset, text.length); index >= 0; index -= 1) {
    if (!text.startsWith(before, index)) continue;
    if (!isStandaloneInlineMarker(text, index, before)) continue;
    const contentStart = index + before.length;
    const closingIndex = text.indexOf(after, Math.max(contentStart, offset));
    if (closingIndex >= contentStart && isStandaloneInlineMarker(text, closingIndex, after)) return index;
  }

  return null;
}

function isStandaloneInlineMarker(text: string, index: number, marker: string): boolean {
  if (marker !== "*" && marker !== "_") return true;

  return text[index - 1] !== marker && text[index + marker.length] !== marker;
}

function isStandaloneInlineBoundary(state: EditorState, position: number, marker: string): boolean {
  if (marker !== "*" && marker !== "_") return true;

  const before = position > 0 ? state.sliceDoc(position - 1, position) : "";
  const after = position + marker.length < state.doc.length
    ? state.sliceDoc(position + marker.length, position + marker.length + 1)
    : "";

  return before !== marker && after !== marker;
}

function toggleMarkdownLink(
  state: EditorState,
  from: number,
  to: number
): ToolbarRangeChange | null {
  if (from === to) return null;

  const doc = state.doc.toString();
  const selected = doc.slice(from, to);

  if (doc[from - 1] === "[" && doc[to] === "]" && doc[to + 1] === "(") {
    const closeParen = doc.indexOf(")", to + 2);
    if (closeParen > to + 2) {
      return {
        changes: [
          { from: to, to: closeParen + 1, insert: "" },
          { from: from - 1, to: from, insert: "" }
        ],
        range: EditorSelection.range(from - 1, from - 1 + selected.length)
      };
    }
  }

  const fullMatch = selected.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (fullMatch) {
    return {
      changes: { from, to, insert: fullMatch[1] },
      range: EditorSelection.range(from, from + fullMatch[1].length)
    };
  }

  return null;
}

function editMarkdownLink(
  state: EditorState,
  from: number,
  to: number,
  url: string
): ToolbarRangeChange | null {
  const link = markdownLinkAtRange(state, from, to);
  if (!link) return null;

  const selectedUrlOnly = from === link.urlFrom && to === link.urlTo;
  const cursorInsideLink = from === to && from > link.from && from < link.to;
  if (!selectedUrlOnly && !cursorInsideLink) return null;

  return {
    changes: { from: link.urlFrom, to: link.urlTo, insert: url },
    range: EditorSelection.range(link.textFrom, link.textTo)
  };
}

function markdownLinkAtRange(
  state: EditorState,
  from: number,
  to: number
): {
  from: number;
  textFrom: number;
  textTo: number;
  to: number;
  urlFrom: number;
  urlTo: number;
} | null {
  const line = state.doc.lineAt(from);
  if (to > line.to) return null;

  const linkPattern = /\[([^\]\n]+)\]\(([^)\n]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(line.text)) !== null) {
    const linkFrom = line.from + match.index;
    const textFrom = linkFrom + 1;
    const textTo = textFrom + match[1].length;
    const urlFrom = textTo + 2;
    const urlTo = urlFrom + match[2].length;
    const linkTo = urlTo + 1;

    if (from >= linkFrom && to <= linkTo) {
      return {
        from: linkFrom,
        textFrom,
        textTo,
        to: linkTo,
        urlFrom,
        urlTo
      };
    }
  }

  return null;
}

function hasBlockId(text: string): boolean {
  return /(?:^|\s)\^[A-Za-z0-9_-]+$/.test(text.trimEnd());
}

function findParagraphEndLineNumbers(state: EditorState): number[] {
  const lineNumbers = new Set<number>();
  const { doc } = state;

  for (const range of state.selection.ranges) {
    const fromLine = doc.lineAt(range.from);
    const toLine = doc.lineAt(range.to);

    if (range.empty) {
      let endLine = fromLine;

      while (endLine.number < doc.lines) {
        const nextLine = doc.line(endLine.number + 1);
        if (nextLine.text.trim() === "") break;
        endLine = nextLine;
      }

      lineNumbers.add(endLine.number);
      continue;
    }

    let paragraphEnd: number | null = null;

    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber += 1) {
      const line = doc.line(lineNumber);

      if (line.text.trim() === "") {
        if (paragraphEnd !== null) lineNumbers.add(paragraphEnd);
        paragraphEnd = null;
        continue;
      }

      paragraphEnd = lineNumber;
    }

    if (paragraphEnd !== null) lineNumbers.add(paragraphEnd);
  }

  return Array.from(lineNumbers).toSorted((a, b) => a - b);
}
