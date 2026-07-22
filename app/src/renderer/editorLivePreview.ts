import { StateEffect } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

import { diagramLanguageFor } from "./diagramLanguage";
import { diagramEditRangeField } from "./editorDiagramEditState";
import { DiagramBlockWidget } from "./editorDiagramLivePreview";
import { findFrontmatterLineRange } from "./editorFrontmatter";
import {
  blockMathRangesInVisibleRanges,
  blockSource,
  currentSyntaxBlock,
  fencedCodeBlocksInVisibleRanges,
  lineNumberAtBlockEnd,
  tableRangesInVisibleRanges,
  type FencedCodeBlockRange
} from "./editorLivePreviewBlocks";
import {
  collectInlineMatches,
  findClickableLinkAtPosition,
  tagNameForInlineMatch,
  type ClickableLinkAtPosition,
  type InlineMatch,
  type SourceRevealRange
} from "./editorLivePreviewModel";
import {
  CheckboxWidget,
  FootnoteDefinitionMarkerWidget,
  HorizontalRuleWidget,
  ImageWidget,
  InlineFormatWidget,
  ListMarkerWidget,
  MathWidget
} from "./editorLivePreviewWidgets";
import { createTranslator, type Translator } from "./i18nModel";
import { resolveWorkspaceImagePath } from "./previewMarkdown";
import { previewImageContextKey } from "./previewImageLoader";
import { editorHeavyUpdateDelay } from "./editorComplexity";
import { editorFrameUpdateEffect, scheduleEditorFrameEffect } from "./editorFrameUpdates";

export {
  __buildLivePreviewBlockDecorationsForTests,
  __codeBlockPreviewRefreshEffectForTests,
  __codeBlockPreviewVisibleRangesEffectForTests,
  createLivePreviewCodeBlockField,
  type __CodeBlockDecorationTestHooks
} from "./editorLivePreviewBlockField";
export { findClickableLinkAtPosition, type ClickableLinkAtPosition } from "./editorLivePreviewModel";

export const livePreviewCompositionEndedEffect = StateEffect.define<null>();

export interface LivePreviewDecorationTestHooks {
  onRebuild?: (reason: "create" | "compositionEnd" | "docChanged" | "selection" | "viewport" | "focus" | "editorState") => void;
}

export function createLivePreviewDecorationsPlugin(
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void,
  t: Translator = createTranslator("system"),
  workspacePath?: string | null,
  sourcePath?: string,
  workspaceRevision = 0,
  testHooks?: LivePreviewDecorationTestHooks
) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    private pendingReason: "docChanged" | "viewport" | null = null;
    private selectionSourceKey: string;
    private wasComposing = false;

    constructor(view: EditorView) {
      testHooks?.onRebuild?.("create");
      this.decorations = buildLivePreviewDecorations(
        view,
        onOpenClickableLink,
        t,
        workspacePath,
        sourcePath,
        workspaceRevision
      );
      this.selectionSourceKey = selectionSourceKey(view);
    }

    update(update: ViewUpdate): void {
      if (update.view.composing) {
        if (update.docChanged) this.decorations = this.decorations.map(update.changes);
        this.wasComposing = true;
        return;
      }

      const previousDiagramEditRange = update.startState.field(diagramEditRangeField, false);
      const nextDiagramEditRange = update.state.field(diagramEditRangeField, false);
      const compositionEnded = update.transactions.some((transaction) => (
        transaction.effects.some((effect) => effect.is(livePreviewCompositionEndedEffect))
      ));
      const frameUpdate = update.transactions.some((transaction) => (
        transaction.effects.some((effect) => effect.is(editorFrameUpdateEffect))
      ));

      if (update.docChanged && !this.wasComposing && !compositionEnded) {
        this.decorations = this.decorations.map(update.changes);
        this.pendingReason = "docChanged";
        scheduleEditorFrameEffect(
          update.view,
          "inline-preview",
          () => null,
          editorHeavyUpdateDelay(update.state.doc, update.view.visibleRanges)
        );
        return;
      }
      if (update.viewportChanged && !compositionEnded) {
        this.pendingReason = "viewport";
        scheduleEditorFrameEffect(update.view, "inline-preview", () => null);
        return;
      }
      const reason = this.wasComposing || compositionEnded
        ? "compositionEnd"
        : frameUpdate && this.pendingReason
          ? this.pendingReason
          : previousDiagramEditRange !== nextDiagramEditRange
            ? "editorState"
            : update.selectionSet
              ? "selection"
              : update.focusChanged
                ? "focus"
                  : null;
      this.wasComposing = false;
      this.pendingReason = null;
      if (!reason) return;
      if (reason === "selection") {
        const nextSelectionSourceKey = selectionSourceKey(update.view);
        if (nextSelectionSourceKey === this.selectionSourceKey) return;
      }

      testHooks?.onRebuild?.(reason);
      this.decorations = buildLivePreviewDecorations(
        update.view,
        onOpenClickableLink,
        t,
        workspacePath,
        sourcePath,
        workspaceRevision
      );
      this.selectionSourceKey = selectionSourceKey(update.view);
    }
  }, {
    decorations: (plugin) => plugin.decorations
  });
}

function selectionSourceKey(view: EditorView): string {
  const keys: string[] = [];
  for (const selection of view.state.selection.ranges) {
    if (!selection.empty) {
      keys.push(`selection:${selection.from}:${selection.to}`);
      continue;
    }
    const line = view.state.doc.lineAt(selection.head);
    if (/^(?:#{1,6}\s+|\s{0,3}([-*_])(?:\s*\1){2,}\s*$|\s*>\s?|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*\[\^[^\]\n]+\]:\s?)/.test(line.text)) {
      keys.push(`line:${line.from}:${line.to}`);
      continue;
    }
    for (const match of collectInlineMatches(line.from, line.text)) {
      if (selection.head >= match.from && selection.head <= match.to) {
        keys.push(`inline:${match.from}:${match.to}`);
      }
    }
  }
  return keys.join("|");
}

export function buildLivePreviewDecorations(
  view: EditorView,
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void,
  t: Translator = createTranslator("system"),
  workspacePath?: string | null,
  sourcePath?: string,
  workspaceRevision = 0
): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const editorHasFocus = typeof view.hasFocus === "boolean" ? view.hasFocus : true;
  const diagramEditRange = state.field(diagramEditRangeField, false);

  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const codeBlocks = fencedCodeBlocksInVisibleRanges(state, view.visibleRanges);
  const mathBlocks = blockMathRangesInVisibleRanges(state, view.visibleRanges);
  const tableBlocks = tableRangesInVisibleRanges(state, view.visibleRanges);
  const frontmatterLineRange = findFrontmatterLineRange(doc);
  const sourceRevealRanges: SourceRevealRange[] = [];
  let codeBlockIndex = 0;
  let mathBlockIndex = 0;
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

      if (match.className === "cm-live-image") {
        const imagePath = resolveWorkspaceImagePath(match.href);
        if (imagePath && workspacePath) {
          addWidget(
            match.from,
            match.to,
            new ImageWidget(imagePath, match.content ?? "", previewImageContextKey(workspacePath, workspaceRevision))
          );
        } else {
          addWidget(
            match.from,
            match.to,
            new InlineFormatWidget("span", match.content ?? "", "cm-live-image-placeholder")
          );
        }
        return;
      }

      const link = match.className === "cm-live-link"
        ? findClickableLinkAtPosition(state.doc, match.from)
        : null;
      const handleClick = link
        ? () => onOpenClickableLink?.(link)
        : undefined;
      const previewAttributes: Record<string, string> = {};
      if (link?.type === "wiki" && link.target && sourcePath) {
        previewAttributes.previewHeading = link.heading ?? "";
        previewAttributes.previewSourcePath = sourcePath;
        previewAttributes.previewTarget = link.target;
      }

      addWidget(
        match.from,
        match.to,
        new InlineFormatWidget(
          tagNameForInlineMatch(match.className),
          text.slice(match.contentFrom - lineFrom, match.contentTo - lineFrom),
          match.className,
          handleClick,
          previewAttributes
        )
      );
      return;
    }

    addSourceReveal(match.from, match.to);
    if (match.className === "cm-live-math-inline" || match.className === "cm-live-footnote-ref" || match.className === "cm-live-image") return;

    addMark(match.contentFrom, match.contentTo, match.className);
    for (const hideRange of match.hideRanges) addReplace(hideRange.from, hideRange.to);
  }

  function addInlineDecorations(lineFrom: number, text: string) {
    for (const match of collectInlineMatches(lineFrom, text)) addInlineFormat(lineFrom, match, text);
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

  for (const { from: visFrom, to: visTo } of view.visibleRanges) {
    let lineNumber = doc.lineAt(visFrom).number;

    while (lineNumber <= doc.lineAt(visTo).number) {
      const line = doc.line(lineNumber);
      const text = line.text;
      while (codeBlockIndex < codeBlocks.length && codeBlocks[codeBlockIndex].to <= line.from) codeBlockIndex += 1;
      while (mathBlockIndex < mathBlocks.length && mathBlocks[mathBlockIndex].to < line.from) mathBlockIndex += 1;
      while (tableBlockIndex < tableBlocks.length && tableBlocks[tableBlockIndex].to < line.from) tableBlockIndex += 1;
      const codeBlock = currentSyntaxBlock(codeBlocks, codeBlockIndex, line.from, line.to);
      const mathBlock = currentSyntaxBlock(mathBlocks, mathBlockIndex, line.from, line.to);
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

      if (mathBlock) {
        lineNumber = lineNumberAtBlockEnd(doc, mathBlock.to) + 1;
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
        // Closed block math is handled by the StateField-backed block preview.
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
