import { EditorSelection } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type BlockIdFactory = () => string;
export type ListFormatKind = "bullet" | "checkbox" | "ordered";

interface MarkdownListLine {
  content: string;
  indent: string;
  kind: ListFormatKind;
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

export function insertMarkdownLink(view: EditorView, url: string, placeholderLinkText: string): void {
  const { state } = view;
  const selected = state.sliceDoc(state.selection.main.from, state.selection.main.to);
  const text = selected || placeholderLinkText;

  view.dispatch({
    changes: {
      from: state.selection.main.from,
      to: state.selection.main.to,
      insert: `[${text}](${url})`
    }
  });
  view.focus();
}

export function insertInternalLink(view: EditorView): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
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

  return [...lineNumbers].sort((a, b) => a - b);
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
