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
  HorizontalRuleWidget,
  InlineFormatWidget,
  ListMarkerWidget
} from "./editorLivePreviewWidgets";
import { findTableBlocks } from "./editorTables";
import { diagramLanguageFor } from "./diagramLanguage";
import { isClosingBacktickFence, parseBacktickOpeningFence } from "./markdownCodeFence";

export { findClickableLinkAtPosition, type ClickableLinkAtPosition } from "./editorLivePreviewModel";

export function buildLivePreviewDecorations(
  view: EditorView,
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void
): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;
  const diagramEditRange = state.field(diagramEditRangeField, false);

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const tableBlocks = findTableBlocks(state);
  const frontmatterLineRange = findFrontmatterLineRange(doc);
  const sourceRevealRanges: SourceRevealRange[] = [];

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
    addMark(match.contentFrom, match.contentTo, match.className);
    for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
  }

  function addInlineDecorations(lineFrom: number, text: string) {
    for (const match of collectInlineMatches(lineFrom, text)) addInlineFormat(lineFrom, match, text);
  }

  function openFenceLengthBefore(lineNumber: number): number | null {
    let activeFenceLength: number | null = null;

    for (let currentLine = 1; currentLine < lineNumber; currentLine += 1) {
      const text = doc.line(currentLine).text;

      if (activeFenceLength === null) {
        activeFenceLength = parseBacktickOpeningFence(text)?.markerLength ?? null;
        continue;
      }

      if (isClosingBacktickFence(text, activeFenceLength)) activeFenceLength = null;
    }

    return activeFenceLength;
  }

  function findClosingFenceLine(startLineNumber: number, openingMarkerLength: number): number | null {
    for (let currentLine = startLineNumber + 1; currentLine <= doc.lines; currentLine += 1) {
      if (isClosingBacktickFence(doc.line(currentLine).text, openingMarkerLength)) return currentLine;
    }

    return null;
  }

  function codeBlockSource(startLineNumber: number, closingLineNumber: number): string {
    if (closingLineNumber <= startLineNumber + 1) return "";

    return doc.sliceString(doc.line(startLineNumber + 1).from, doc.line(closingLineNumber - 1).to);
  }

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;
    let activeFenceLength = openFenceLengthBefore(lineNumber);

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      const text = line.text;
      const tableBlock = tableBlocks.find((block) => line.from >= block.from && line.to <= block.to);

      if (
        frontmatterLineRange &&
        lineNumber >= frontmatterLineRange.start &&
        lineNumber <= frontmatterLineRange.end
      ) {
        addMark(line.from, line.to, "cm-live-frontmatter");
        lineNumber += 1;
        continue;
      }

      if (activeFenceLength !== null) {
        if (isClosingBacktickFence(text, activeFenceLength)) {
          addSourceReveal(line.from, line.to);
          addReplace(line.from, line.to);
          activeFenceLength = null;
          lineNumber += 1;
          continue;
        }

        if (tableBlock) {
          lineNumber += 1;
          continue;
        }

        addMark(line.from, line.to, "cm-live-code-block");
        lineNumber += 1;
        continue;
      }

      const openingFence = parseBacktickOpeningFence(text);
      if (openingFence) {
        const diagramLanguage = diagramLanguageFor(openingFence.language);

        if (diagramLanguage) {
          const closingLineNumber = findClosingFenceLine(lineNumber, openingFence.markerLength);

          if (closingLineNumber) {
            const blockFrom = line.from;
            const blockTo = doc.line(closingLineNumber).to;
            const editCursor = closingLineNumber > lineNumber + 1
              ? doc.line(lineNumber + 1).from
              : line.to;

            if (!isDiagramSourceEditing(blockFrom, blockTo)) {
              addWidget(
                line.from,
                line.to,
                new DiagramBlockWidget(
                  codeBlockSource(lineNumber, closingLineNumber),
                  diagramLanguage,
                  blockFrom,
                  blockTo,
                  editCursor
                )
              );

              for (let hiddenLineNumber = lineNumber + 1; hiddenLineNumber <= closingLineNumber; hiddenLineNumber += 1) {
                const hiddenLine = doc.line(hiddenLineNumber);
                addReplace(hiddenLine.from, hiddenLine.to);
              }
            }

            lineNumber = closingLineNumber + 1;
            continue;
          }
        }

        addSourceReveal(line.from, line.to);
        addReplace(line.from, line.to);
        activeFenceLength = openingFence.markerLength;
        lineNumber += 1;
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
          addSourceReveal(line.from, line.to);
          addWidget(line.from, contentFrom, new CheckboxWidget(/[xX]/.test(match[2])));
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
