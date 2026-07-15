import { EditorSelection, type ChangeSpec, type EditorState, type SelectionRange } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { rangeIntersectsFencedCodeBlock } from "./markdownCodeBlockRanges";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
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

export function insertAtLineStart(view: EditorView, prefix: string, placeholder: string): void {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.from);
    if (rangeIntersectsFencedCodeBlock(state, line.from, line.to)) return preserveRange(range);

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
    if (rangeIntersectsFencedCodeBlock(state, range.from, range.to)) return preserveRange(range);

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
    const orderedCounters = new Map<string, number>();
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
      const indent = parsed?.indent ?? plain.indent;
      const index = kind === "ordered" ? nextOrderedListIndex(indent, orderedCounters) : appliedIndex;
      nextLines.push(`${indent}${listPrefix(kind, index)}${parsed?.content ?? plain.content}`);
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

function preserveRange(range: SelectionRange): ToolbarRangeChange {
  return {
    changes: [],
    range
  };
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

function listPrefix(kind: ListFormatKind, index: number): string {
  if (kind === "ordered") return `${index + 1}. `;
  if (kind === "checkbox") return "- [ ] ";
  return "- ";
}

function nextOrderedListIndex(indent: string, counters: Map<string, number>): number {
  for (const key of Array.from(counters.keys())) {
    if (key.length > indent.length) counters.delete(key);
  }

  const index = counters.get(indent) ?? 0;
  counters.set(indent, index + 1);
  return index;
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
