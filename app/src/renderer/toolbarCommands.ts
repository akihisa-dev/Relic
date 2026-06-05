import { EditorSelection } from "@codemirror/state";
import type { ChangeSpec, EditorState, SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type BlockIdFactory = () => string;
export type ListFormatKind = "bullet" | "checkbox" | "ordered";

interface MarkdownListLine {
  content: string;
  indent: string;
  kind: ListFormatKind;
}

interface ToolbarRangeChange {
  changes: ChangeSpec;
  range: SelectionRange;
}

const markdownListLinePattern = /^(\s*)((?:[-+*]\s+(?:\[[ xX]\]\s+)?)|(?:\d+\.\s+))(.*)$/;

export function findToolbarTargetView(
  views: EditorView[],
  lastTargetView: EditorView | null
): EditorView | null {
  const activeDomView = findActiveElementView();
  if (activeDomView) return activeDomView;

  const activeView = views.find(viewContainsActiveElement);
  if (activeView) return activeView;

  const selectedDomView = findBrowserSelectionView();
  if (selectedDomView) return selectedDomView;

  const selectedView = views.find(viewContainsBrowserSelection);
  if (selectedView) return selectedView;

  const focusedView = views.find((view) => view.hasFocus);
  if (focusedView) return focusedView;

  const selectedStateViews = views.filter(viewHasNonEmptySelection);
  if (selectedStateViews.length === 1) return selectedStateViews[0];

  return lastTargetView ?? views[0] ?? null;
}

export function wrapSelection(view: EditorView, before: string, after: string, placeholder: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
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

  view.dispatch(changes);
  view.focus();
}

export function insertAtLineStart(view: EditorView, prefix: string, placeholder: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    const heading = parseHeadingPrefix(prefix);
    const headingToggle = heading ? toggleHeadingLine(line, heading) : null;
    if (headingToggle) return headingToggle;

    const quoteToggle = prefix === "> " ? toggleBlockquoteLine(line, placeholder) : null;
    if (quoteToggle) return quoteToggle;

    const insert = `${prefix}${line.text.length > 0 ? line.text : placeholder}`;

    return {
      changes: { from: line.from, to: line.to, insert },
      range: EditorSelection.range(line.from + prefix.length, line.from + insert.length)
    };
  });

  view.dispatch(changes);
  view.focus();
}

export function insertListAtSelectedLines(
  view: EditorView,
  kind: ListFormatKind,
  placeholder: string
): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const fromLine = state.doc.lineAt(range.from);
    const toPosition = !range.empty && range.to > range.from ? range.to - 1 : range.to;
    const toLine = state.doc.lineAt(toPosition);
    const isMultiLine = fromLine.number !== toLine.number;

    if (!isMultiLine) {
      const parsed = parseMarkdownListLine(fromLine.text);
      const plain = parsePlainLine(fromLine.text);
      const nextText = parsed?.kind === kind
        ? `${parsed.indent}${parsed.content}`
        : `${parsed?.indent ?? plain.indent}${listPrefix(kind, 0)}${parsed?.content ?? (plain.content.length > 0 ? plain.content : placeholder)}`;

      return {
        changes: { from: fromLine.from, to: fromLine.to, insert: nextText },
        range: EditorSelection.range(fromLine.from, fromLine.from + nextText.length)
      };
    }

    let appliedIndex = 0;
    const nextLines: string[] = [];
    const targetLines = selectedNonEmptyLines(state, fromLine.number, toLine.number);
    const shouldRemove = targetLines.length > 0
      && targetLines.every((line) => parseMarkdownListLine(line.text)?.kind === kind);

    for (let lineNumber = fromLine.number; lineNumber <= toLine.number; lineNumber += 1) {
      const line = state.doc.line(lineNumber);

      if (line.text.trim() === "") {
        nextLines.push(line.text);
        continue;
      }

      const parsed = parseMarkdownListLine(line.text);
      if (shouldRemove && parsed) {
        nextLines.push(`${parsed.indent}${parsed.content}`);
        continue;
      }

      const plain = parsePlainLine(line.text);
      nextLines.push(`${parsed?.indent ?? plain.indent}${listPrefix(kind, appliedIndex)}${parsed?.content ?? plain.content}`);
      appliedIndex += 1;
    }

    const insert = nextLines.join("\n");

    return {
      changes: { from: fromLine.from, to: toLine.to, insert },
      range: EditorSelection.range(fromLine.from, fromLine.from + insert.length)
    };
  });

  view.dispatch(changes);
  view.focus();
}

export function insertBlock(view: EditorView, text: string): void {
  const { state } = view;
  const pos = state.selection.main.from;
  const line = state.doc.lineAt(pos);
  const prefix = line.from > 0 ? "\n" : "";

  view.dispatch({
    changes: { from: line.to, insert: `${prefix}\n${text}\n` },
    selection: { anchor: line.to + prefix.length + 1 + text.length + 1 }
  });
  view.focus();
}

export function insertCodeBlock(view: EditorView): void {
  const { state } = view;

  if (state.selection.ranges.every((range) => range.empty)) {
    insertBlock(view, "```\n\n```");
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

  view.dispatch(changes);
  view.focus();
}

export function insertMarkdownLink(view: EditorView, url: string, placeholderLinkText: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const selectedToggle = toggleMarkdownLink(state, range.from, range.to);
    if (selectedToggle) return selectedToggle;

    const selected = state.sliceDoc(range.from, range.to);
    const text = selected || placeholderLinkText;

    return {
      changes: { from: range.from, to: range.to, insert: `[${text}](${url})` },
      range: EditorSelection.range(range.from + 1, range.from + 1 + text.length)
    };
  });

  view.dispatch(changes);
  view.focus();
}

export function insertInternalLink(view: EditorView): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
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

  view.dispatch(changes);
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
    view.dispatch({ changes });
  }

  view.focus();
}

function viewContainsBrowserSelection(view: EditorView): boolean {
  const selection = window.getSelection();
  const anchorNode = selection?.anchorNode;
  const focusNode = selection?.focusNode;

  if (!selection || selection.isCollapsed || !anchorNode || !focusNode) return false;

  return view.dom.contains(anchorNode) || view.dom.contains(focusNode);
}

function findViewFromNode(node: Node | null): EditorView | null {
  const element = node instanceof Element ? node : node?.parentElement ?? null;

  return element instanceof HTMLElement ? EditorView.findFromDOM(element) ?? null : null;
}

function findBrowserSelectionView(): EditorView | null {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) return null;

  return findViewFromNode(selection.anchorNode) ?? findViewFromNode(selection.focusNode);
}

function findActiveElementView(): EditorView | null {
  return findViewFromNode(document.activeElement);
}

function viewContainsActiveElement(view: EditorView): boolean {
  const activeElement = document.activeElement;

  return activeElement !== null && view.dom.contains(activeElement);
}

function viewHasNonEmptySelection(view: EditorView): boolean {
  return view.state.selection.ranges.some((range) => !range.empty);
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

function parseHeadingPrefix(prefix: string): HeadingLevel | null {
  const match = prefix.match(/^(#{1,6}) $/);
  if (!match) return null;

  return match[1].length as HeadingLevel;
}

function toggleHeadingLine(
  line: { from: number; text: string },
  level: HeadingLevel
): ToolbarRangeChange | null {
  const match = line.text.match(/^(\s*)(#{1,6})\s+(.*)$/);
  if (!match) return null;

  const indent = match[1];
  const existingLevel = match[2].length;
  const content = match[3];
  const nextText = existingLevel === level
    ? `${indent}${content}`
    : `${indent}${"#".repeat(level)} ${content}`;
  const selectionStart = line.from + nextText.length - content.length;

  return {
    changes: { from: line.from, to: line.from + line.text.length, insert: nextText },
    range: EditorSelection.range(selectionStart, line.from + nextText.length)
  };
}

function toggleBlockquoteLine(
  line: { from: number; text: string },
  placeholder: string
): ToolbarRangeChange | null {
  const match = line.text.match(/^(\s*)>\s?(.*)$/);
  if (!match) return null;

  const nextText = `${match[1]}${match[2] || placeholder}`;

  return {
    changes: { from: line.from, to: line.from + line.text.length, insert: nextText },
    range: EditorSelection.range(line.from + match[1].length, line.from + nextText.length)
  };
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

function listPrefix(kind: ListFormatKind, index: number): string {
  if (kind === "ordered") return `${index + 1}. `;
  if (kind === "checkbox") return "- [ ] ";
  return "- ";
}

function parseMarkdownListLine(text: string): MarkdownListLine | null {
  const match = text.match(markdownListLinePattern);
  if (!match) return null;

  return {
    content: match[3],
    indent: match[1],
    kind: listMarkerKind(match[2])
  };
}

function listMarkerKind(marker: string): ListFormatKind {
  if (/^\d+\.\s+$/.test(marker)) return "ordered";
  if (/^[-+*]\s+\[[ xX]\]\s+$/.test(marker)) return "checkbox";
  return "bullet";
}

function parsePlainLine(text: string): Pick<MarkdownListLine, "content" | "indent"> {
  const match = text.match(/^(\s*)(.*)$/);

  return {
    content: match?.[2] ?? text,
    indent: match?.[1] ?? ""
  };
}

function selectedNonEmptyLines(
  state: EditorState,
  fromLineNumber: number,
  toLineNumber: number
): Array<{ text: string }> {
  const lines: Array<{ text: string }> = [];

  for (let lineNumber = fromLineNumber; lineNumber <= toLineNumber; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (line.text.trim() !== "") lines.push({ text: line.text });
  }

  return lines;
}
