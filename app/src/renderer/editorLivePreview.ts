import { syntaxTree } from "@codemirror/language";
import { ChangeSet, StateField, type EditorState, type Text, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";

import { findFrontmatterLineRange } from "./editorFrontmatter";
import {
  collectInlineMatches,
  findClickableLinkAtPosition,
  tagNameForInlineMatch,
  type ClickableLinkAtPosition,
  type InlineMatch,
  type SourceRevealRange
} from "./editorLivePreviewModel";
import { diagramEditRangeField } from "./editorDiagramEditState";
import { DiagramBlockWidget } from "./editorDiagramLivePreview";
import {
  CheckboxWidget,
  CodeBlockWidget,
  FootnoteDefinitionMarkerWidget,
  HorizontalRuleWidget,
  InlineFormatWidget,
  ListMarkerWidget,
  MathWidget
} from "./editorLivePreviewWidgets";
import { diagramLanguageFor } from "./diagramLanguage";
import { createTranslator, type Translator } from "./i18nModel";
import { parseBacktickOpeningFence } from "./markdownCodeFence";

export { findClickableLinkAtPosition, type ClickableLinkAtPosition } from "./editorLivePreviewModel";

interface SyntaxBlockRange {
  from: number;
  to: number;
}

interface FencedCodeBlockRange extends SyntaxBlockRange {
  language: string | null;
}

interface CodeBlockPreviewState {
  decorations: DecorationSet;
  revealedRanges: SyntaxBlockRange[];
}

function sortedUniqueRanges<T extends SyntaxBlockRange>(ranges: T[]): T[] {
  return Array.from(new Map(ranges.map((range) => [`${range.from}:${range.to}`, range])).values())
    .toSorted((a, b) => a.from - b.from || a.to - b.to);
}

function syntaxBlocksInVisibleRanges(
  state: EditorState,
  visibleRanges: readonly SyntaxBlockRange[],
  nodeName: "FencedCode" | "Table"
): SyntaxBlockRange[] {
  const ranges: SyntaxBlockRange[] = [];
  const tree = syntaxTree(state);

  for (const visibleRange of visibleRanges) {
    tree.iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter: (node) => {
        if (node.name === nodeName) ranges.push({ from: node.from, to: node.to });
      }
    });
  }

  return sortedUniqueRanges(ranges);
}

function fencedCodeBlocksInVisibleRanges(
  state: EditorState,
  visibleRanges: readonly SyntaxBlockRange[]
): FencedCodeBlockRange[] {
  return syntaxBlocksInVisibleRanges(state, visibleRanges, "FencedCode").map((range) => {
    const openingFence = parseBacktickOpeningFence(state.doc.lineAt(range.from).text);
    return { ...range, language: openingFence?.language ?? null };
  });
}

function tableRangesInVisibleRanges(state: EditorState, visibleRanges: readonly SyntaxBlockRange[]): SyntaxBlockRange[] {
  return syntaxBlocksInVisibleRanges(state, visibleRanges, "Table");
}

function lineNumberAtBlockEnd(doc: Text, to: number): number {
  return doc.lineAt(Math.max(0, to - 1)).number;
}

function blockSource(doc: Text, block: SyntaxBlockRange): string {
  const startLine = doc.lineAt(block.from).number;
  const endLine = lineNumberAtBlockEnd(doc, block.to);

  if (endLine <= startLine + 1) return "";

  return doc.sliceString(doc.line(startLine + 1).from, doc.line(endLine - 1).to);
}

function buildCodeBlockPreviewDecorations(state: EditorState, t: Translator): CodeBlockPreviewState {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const revealedRanges: SyntaxBlockRange[] = [];
  const doc = state.doc;
  const codeBlocks = fencedCodeBlocksInVisibleRanges(state, [{ from: 0, to: state.doc.length }]);

  function selectionTouches(from: number, to: number): boolean {
    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from >= from && range.from <= to;
      return range.from <= to && range.to >= from;
    });
  }

  for (const block of codeBlocks) {
    if (diagramLanguageFor(block.language)) continue;
    if (selectionTouches(block.from, block.to)) {
      revealedRanges.push({ from: block.from, to: block.to });
      continue;
    }

    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({
        block: true,
        widget: new CodeBlockWidget(block.language, blockSource(doc, block), t)
      })
    });
  }

  return {
    decorations: Decoration.set(ranges.map((range) => range.deco.range(range.from, range.to)), true),
    revealedRanges
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

function canMapCodeBlockDecorations(transaction: Transaction, decorations: DecorationSet): boolean {
  if (!transaction.docChanged) return true;
  if (changesTouchDecorations(transaction.changes, decorations)) return false;
  return !changedTextIncludes(transaction.changes, transaction.state.doc, /[`$\n]/);
}

function mapSyntaxBlockRanges(changes: ChangeSet, ranges: SyntaxBlockRange[]): SyntaxBlockRange[] {
  return ranges.map((range) => ({
    from: changes.mapPos(range.from),
    to: changes.mapPos(range.to)
  }));
}

function selectionTouchesRanges(state: EditorState, ranges: readonly SyntaxBlockRange[]): boolean {
  return state.selection.ranges.some((selection) => ranges.some((range) => {
    if (selection.empty) return selection.from >= range.from && selection.from <= range.to;
    return selection.from <= range.to && selection.to >= range.from;
  }));
}

function selectionTouchesDecorations(state: EditorState, decorations: DecorationSet): boolean {
  let touches = false;

  for (const selection of state.selection.ranges) {
    decorations.between(selection.from, selection.empty ? selection.from + 1 : selection.to, () => {
      touches = true;
    });
    if (touches) break;
  }

  return touches;
}

function shouldRebuildCodeBlockDecorationsForSelection(state: EditorState, preview: CodeBlockPreviewState): boolean {
  if (selectionTouchesDecorations(state, preview.decorations)) return true;
  if (preview.revealedRanges.length === 0) return false;
  return !selectionTouchesRanges(state, preview.revealedRanges);
}

export function createLivePreviewCodeBlockField(t: Translator = createTranslator("system")) {
  return StateField.define<CodeBlockPreviewState>({
    create: (state) => buildCodeBlockPreviewDecorations(state, t),
    update: (preview, transaction) => {
      if (transaction.docChanged) {
        if (canMapCodeBlockDecorations(transaction, preview.decorations)) {
          return {
            decorations: preview.decorations.map(transaction.changes),
            revealedRanges: mapSyntaxBlockRanges(transaction.changes, preview.revealedRanges)
          };
        }

        return buildCodeBlockPreviewDecorations(transaction.state, t);
      }

      if (transaction.selection && shouldRebuildCodeBlockDecorationsForSelection(transaction.state, preview)) {
        return buildCodeBlockPreviewDecorations(transaction.state, t);
      }

      return preview;
    },
    provide: (field) => EditorView.decorations.from(field, (preview) => preview.decorations)
  });
}

export function buildLivePreviewDecorations(
  view: EditorView,
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void,
  t: Translator = createTranslator("system")
): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;
  const diagramEditRange = state.field(diagramEditRangeField, false);

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const codeBlocks = fencedCodeBlocksInVisibleRanges(state, view.visibleRanges);
  const tableBlocks = tableRangesInVisibleRanges(state, view.visibleRanges);
  const frontmatterLineRange = findFrontmatterLineRange(doc);
  const sourceRevealRanges: SourceRevealRange[] = [];
  let codeBlockIndex = 0;
  let tableBlockIndex = 0;

  function selectionTouches(from: number, to: number): boolean {
    if (!editorHasFocus) return false;

    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from >= from && range.from <= to;
      return range.from <= to && range.to >= from;
    });
  }

  function addSourceReveal(from: number, to: number) {
    if (from < to && selectionTouches(from, to)) sourceRevealRanges.push({ from, to });
  }

  function shouldRevealSource(from: number, to: number): boolean {
    return sourceRevealRanges.some((range) => from >= range.from && to <= range.to);
  }

  function addReplace(from: number, to: number) {
    if (from < to && !shouldRevealSource(from, to)) ranges.push({ from, to, deco: Decoration.replace({}) });
  }

  function addMark(from: number, to: number, cls: string) {
    if (from < to) {
      const attributes = cls === "cm-live-bold"
        ? { style: "display: inline-block; font-weight: 900; padding-inline: 0.015em; text-shadow: 0.025em 0 0 currentColor;" }
        : cls === "cm-live-italic"
          ? { style: "display: inline-block; font-style: italic; transform: skewX(-14deg); transform-origin: baseline;" }
          : undefined;
      ranges.push({ from, to, deco: Decoration.mark({ attributes, class: cls }) });
    }
  }

  function addWidget(from: number, to: number, widget: WidgetType) {
    if (from < to && !shouldRevealSource(from, to)) {
      ranges.push({ from, to, deco: Decoration.replace({ widget }) });
    }
  }

  function isDiagramSourceEditing(from: number, to: number): boolean {
    return Boolean(diagramEditRange && diagramEditRange.from <= from && diagramEditRange.to >= to);
  }

  function addInlineFormat(lineFrom: number, match: InlineMatch, text: string) {
    if (!selectionTouches(match.from, match.to)) {
      if (match.className === "cm-live-math-inline") {
        addWidget(match.from, match.to, new MathWidget(match.content ?? "", false));
        return;
      }

      const link = match.className === "cm-live-link"
        ? findClickableLinkAtPosition(state.doc, match.from)
        : null;
      const handleClick = link
        ? () => onOpenClickableLink?.(link)
        : undefined;

      addWidget(
        match.from,
        match.to,
        new InlineFormatWidget(
          tagNameForInlineMatch(match.className),
          text.slice(match.contentFrom - lineFrom, match.contentTo - lineFrom),
          match.className,
          handleClick
        )
      );
      return;
    }

    addSourceReveal(match.from, match.to);
    if (match.className === "cm-live-math-inline" || match.className === "cm-live-footnote-ref") return;

    addMark(match.contentFrom, match.contentTo, match.className);
    for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
  }

  function addInlineDecorations(lineFrom: number, text: string) {
    for (const match of collectInlineMatches(lineFrom, text)) addInlineFormat(lineFrom, match, text);
  }

  function currentSyntaxBlock<T extends SyntaxBlockRange>(blocks: T[], index: number, lineFrom: number, lineTo: number): T | null {
    const block = blocks[index] ?? null;
    return block !== null && lineFrom >= block.from && lineTo <= block.to ? block : null;
  }

  function addDiagramBlock(block: FencedCodeBlockRange): void {
    const diagramLanguage = diagramLanguageFor(block.language);
    if (!diagramLanguage) return;

    const openingLine = doc.lineAt(block.from);
    const closingLineNumber = lineNumberAtBlockEnd(doc, block.to);
    const editCursor = closingLineNumber > openingLine.number + 1
      ? doc.line(openingLine.number + 1).from
      : openingLine.to;

    if (!isDiagramSourceEditing(block.from, block.to)) {
      addWidget(
        openingLine.from,
        openingLine.to,
        new DiagramBlockWidget(
          blockSource(doc, block),
          diagramLanguage,
          block.from,
          block.to,
          editCursor,
          t
        )
      );

      for (let hiddenLineNumber = openingLine.number + 1; hiddenLineNumber <= closingLineNumber; hiddenLineNumber += 1) {
        const hiddenLine = doc.line(hiddenLineNumber);
        addReplace(hiddenLine.from, hiddenLine.to);
      }
    }
  }

  function findClosingMathLine(startLineNumber: number): number | null {
    for (let currentLine = startLineNumber + 1; currentLine <= doc.lines; currentLine += 1) {
      if (doc.line(currentLine).text.trim() === "$$") return currentLine;
    }

    return null;
  }

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      const text = line.text;
      while (codeBlockIndex < codeBlocks.length && codeBlocks[codeBlockIndex].to <= line.from) codeBlockIndex += 1;
      while (tableBlockIndex < tableBlocks.length && tableBlocks[tableBlockIndex].to < line.from) tableBlockIndex += 1;
      const codeBlock = currentSyntaxBlock(codeBlocks, codeBlockIndex, line.from, line.to);
      const tableBlock = currentSyntaxBlock(tableBlocks, tableBlockIndex, line.from, line.to);

      if (
        frontmatterLineRange &&
        lineNumber >= frontmatterLineRange.start &&
        lineNumber <= frontmatterLineRange.end
      ) {
        addMark(line.from, line.to, "cm-live-frontmatter");
        lineNumber += 1;
        continue;
      }

      if (codeBlock) {
        addDiagramBlock(codeBlock);
        lineNumber = lineNumberAtBlockEnd(doc, codeBlock.to) + 1;
        continue;
      }

      if (tableBlock) {
        lineNumber += 1;
        continue;
      }

      const headingMatch = /^(#{1,6})\s+(.+)$/.exec(text);
      if (headingMatch) {
        const markerFrom = line.from;
        const contentFrom = line.from + headingMatch[1].length + 1;
        addSourceReveal(line.from, line.to);
        addMark(contentFrom, line.to, `cm-live-h${headingMatch[1].length}`);
        addReplace(markerFrom, contentFrom);
        addInlineDecorations(contentFrom, text.slice(contentFrom - line.from));
      } else if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
        addSourceReveal(line.from, line.to);
        addWidget(line.from, line.to, new HorizontalRuleWidget());
      } else if (/^\s*\$\$/.test(text)) {
        const singleLineMatch = /^\s*\$\$(.*?)\$\$\s*$/.exec(text);
        const closingLineNumber = singleLineMatch ? lineNumber : findClosingMathLine(lineNumber);

        if (closingLineNumber) {
          const blockTo = doc.line(closingLineNumber).to;
          const source = singleLineMatch
            ? singleLineMatch[1].trim()
            : doc.sliceString(doc.line(lineNumber + 1).from, doc.line(closingLineNumber - 1).to).trim();
          addSourceReveal(line.from, blockTo);
          addWidget(line.from, blockTo, new MathWidget(source, true));
          lineNumber = closingLineNumber + 1;
          continue;
        }
      } else if (/^\s*>\s?/.test(text)) {
        const match = /^(\s*>\s?)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addReplace(line.from, contentFrom);
          addMark(contentFrom, line.to, "cm-live-blockquote");
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*[-*+]\s+\[[ xX]\]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          const checkmarkFrom = line.from + match[1].indexOf("[") + 1;
          const checked = /[xX]/.test(match[2]);
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new CheckboxWidget(checked, () => {
            view.dispatch({
              changes: { from: checkmarkFrom, to: checkmarkFrom + 1, insert: checked ? " " : "x" },
              selection: { anchor: checkmarkFrom + 1 }
            });
          }, t));
          addInlineDecorations(contentFrom, match[3]);
        }
      } else if (/^\s*[-*+]\s+/.test(text)) {
        const match = /^(\s*[-*+]\s+)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new ListMarkerWidget("•", "cm-live-list-marker"));
          addInlineDecorations(contentFrom, match[2]);
        }
      } else if (/^\s*\d+[.)]\s+/.test(text)) {
        const match = /^(\s*)(\d+)([.)]\s+)(.*)$/.exec(text);
        if (match) {
          const markerTo = line.from + match[0].length - match[4].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, markerTo, new ListMarkerWidget(`${match[2]}.`, "cm-live-ordered-marker"));
          addInlineDecorations(markerTo, match[4]);
        }
      } else if (/^\s*\[\^([^\]\n]+)\]:\s?/.test(text)) {
        const match = /^(\s*\[\^([^\]\n]+)\]:\s?)(.*)$/.exec(text);
        if (match) {
          const contentFrom = line.from + match[1].length;
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new FootnoteDefinitionMarkerWidget(match[2]));
          addInlineDecorations(contentFrom, match[3]);
        }
      } else {
        addInlineDecorations(line.from, text);
      }

      lineNumber += 1;
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  return Decoration.set(
    ranges.map(({ from, to, deco }) => deco.range(from, to)),
    true
  );
}
