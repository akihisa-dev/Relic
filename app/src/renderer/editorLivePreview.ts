import { ChangeSet, StateEffect, StateField, type EditorState, type Text, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { ViewUpdate } from "@codemirror/view";
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
  blockMathRangesInVisibleRanges,
  blockSource,
  codeBlockFenceRanges,
  currentSyntaxBlock,
  fencedCodeBlocksInVisibleRanges,
  lineNumberAtBlockEnd,
  normalizeVisibleRanges,
  sortedUniqueRanges,
  tableRangesInVisibleRanges,
  type FencedCodeBlockRange,
  type SyntaxBlockRange
} from "./editorLivePreviewBlocks";
import {
  CheckboxWidget,
  clearCodeBlockSourceInteractionEffect,
  codeBlockSourceInteractionEffect,
  CodeBlockWidget,
  FootnoteDefinitionMarkerWidget,
  ImageWidget,
  HorizontalRuleWidget,
  InlineFormatWidget,
  ListMarkerWidget,
  MathWidget
} from "./editorLivePreviewWidgets";
import { diagramLanguageFor } from "./diagramLanguage";
import { createTranslator, type Translator } from "./i18nModel";
import { resolveWorkspaceImageSrc } from "./previewMarkdown";

export { findClickableLinkAtPosition, type ClickableLinkAtPosition } from "./editorLivePreviewModel";

interface CodeBlockPreviewState {
  decorations: DecorationSet;
  editorHasFocus: boolean;
  revealedRanges: SyntaxBlockRange[];
  sourceInteractionRanges: SyntaxBlockRange[];
  visibleRanges: SyntaxBlockRange[];
}

/** @internal Test-only observer for decoration rebuild quality gates. */
export interface __CodeBlockDecorationTestHooks {
  onRebuild?: (reason: "create" | "visibleRanges" | "docChanged" | "selection") => void;
}

const codeBlockPreviewVisibleRangesEffect = StateEffect.define<SyntaxBlockRange[]>();
const codeBlockPreviewFocusEffect = StateEffect.define<boolean>();

/** @internal Test-only access to drive visible range rebuilds without a browser viewport. */
export const __codeBlockPreviewVisibleRangesEffectForTests = codeBlockPreviewVisibleRangesEffect;

function initialVisibleRanges(state: EditorState): SyntaxBlockRange[] {
  return state.doc.length === 0 ? [] : [{ from: 0, to: Math.min(state.doc.length, 1) }];
}

function visibleRangesForView(view: EditorView): SyntaxBlockRange[] {
  return view.visibleRanges.map((range) => ({ from: range.from, to: range.to }));
}

function visibleRangeKey(ranges: readonly SyntaxBlockRange[]): string {
  return ranges.map((range) => `${range.from}:${range.to}`).join("|");
}

function buildCodeBlockPreviewDecorations(
  state: EditorState,
  t: Translator,
  visibleRanges: SyntaxBlockRange[],
  editorHasFocus = false,
  sourceInteractionRanges: SyntaxBlockRange[] = []
): CodeBlockPreviewState {
  const ranges: { from: number; to: number; deco: Decoration }[] = [];
  const revealedRanges: SyntaxBlockRange[] = [];
  const doc = state.doc;
  const normalizedVisibleRanges = normalizeVisibleRanges(doc, visibleRanges);
  const codeBlocks = fencedCodeBlocksInVisibleRanges(state, normalizedVisibleRanges);
  const mathBlocks = blockMathRangesInVisibleRanges(state, normalizedVisibleRanges);

  function selectionTouches(from: number, to: number): boolean {
    return state.selection.ranges.some((range) => {
      if (range.empty) return range.from >= from && range.from <= to;
      return range.from <= to && range.to >= from;
    });
  }

  function focusedSelectionTouches(from: number, to: number): boolean {
    return editorHasFocus && selectionTouches(from, to);
  }

  function hasSourceInteraction(block: SyntaxBlockRange): boolean {
    return sourceInteractionRanges.some((range) => range.from === block.from && range.to === block.to);
  }

  for (const block of codeBlocks) {
    if (diagramLanguageFor(block.language)) continue;
    const fenceRanges = codeBlockFenceRanges(doc, block);
    if (!hasSourceInteraction(block) && fenceRanges.some((range) => selectionTouches(range.from, range.to))) {
      revealedRanges.push(...fenceRanges);
      continue;
    }

    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({ block: true, widget: new CodeBlockWidget(block.language, blockSource(doc, block), block.from, block.to, t) })
    });
  }

  for (const block of mathBlocks) {
    if (focusedSelectionTouches(block.from, block.to)) {
      revealedRanges.push({ from: block.from, to: block.to });
      continue;
    }

    ranges.push({
      from: block.from,
      to: block.to,
      deco: Decoration.replace({ block: true, widget: new MathWidget(block.source, true) })
    });
  }

  return {
    editorHasFocus,
    decorations: Decoration.set(ranges.map((range) => range.deco.range(range.from, range.to)), true),
    revealedRanges,
    sourceInteractionRanges,
    visibleRanges: normalizedVisibleRanges
  };
}

/** @internal Test-only access to inspect StateField-backed block live preview decorations. */
export function __buildLivePreviewBlockDecorationsForTests(
  state: EditorState,
  t: Translator = createTranslator("system"),
  visibleRanges: SyntaxBlockRange[] = state.doc.length === 0 ? [] : [{ from: 0, to: state.doc.length }],
  editorHasFocus = true
): DecorationSet {
  return buildCodeBlockPreviewDecorations(state, t, visibleRanges, editorHasFocus).decorations;
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

function visibleRangeEffect(transaction: Transaction): SyntaxBlockRange[] | null {
  for (const effect of transaction.effects) {
    if (effect.is(codeBlockPreviewVisibleRangesEffect)) return effect.value;
  }

  return null;
}

function focusEffect(transaction: Transaction): boolean | null {
  for (const effect of transaction.effects) {
    if (effect.is(codeBlockPreviewFocusEffect)) return effect.value;
  }

  return null;
}

function sourceInteractionEffect(transaction: Transaction): SyntaxBlockRange | null {
  for (const effect of transaction.effects) {
    if (effect.is(codeBlockSourceInteractionEffect)) return effect.value;
  }

  return null;
}

function clearSourceInteractionEffect(transaction: Transaction): SyntaxBlockRange | null {
  for (const effect of transaction.effects) {
    if (effect.is(clearCodeBlockSourceInteractionEffect)) return effect.value;
  }

  return null;
}

function addSourceInteractionRange(ranges: SyntaxBlockRange[], nextRange: SyntaxBlockRange): SyntaxBlockRange[] {
  return sortedUniqueRanges([...ranges, nextRange]);
}

function removeSourceInteractionRange(ranges: SyntaxBlockRange[], removedRange: SyntaxBlockRange): SyntaxBlockRange[] {
  return ranges.filter((range) => range.from !== removedRange.from || range.to !== removedRange.to);
}

function activeSourceInteractionRanges(state: EditorState, ranges: SyntaxBlockRange[]): SyntaxBlockRange[] {
  return ranges.filter((range) => selectionTouchesRanges(state, [range]));
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

export function createLivePreviewCodeBlockField(
  t: Translator = createTranslator("system"),
  testHooks?: __CodeBlockDecorationTestHooks
) {
  const field = StateField.define<CodeBlockPreviewState>({
    create: (state) => {
      testHooks?.onRebuild?.("create");
      return buildCodeBlockPreviewDecorations(state, t, initialVisibleRanges(state));
    },
    update: (preview, transaction) => {
      const nextVisibleRanges = visibleRangeEffect(transaction);
      if (nextVisibleRanges) {
        testHooks?.onRebuild?.("visibleRanges");
        return buildCodeBlockPreviewDecorations(transaction.state, t, nextVisibleRanges, preview.editorHasFocus, preview.sourceInteractionRanges);
      }

      const nextEditorHasFocus = focusEffect(transaction);
      if (nextEditorHasFocus !== null && nextEditorHasFocus !== preview.editorHasFocus) {
        testHooks?.onRebuild?.("selection");
        return buildCodeBlockPreviewDecorations(transaction.state, t, preview.visibleRanges, nextEditorHasFocus, preview.sourceInteractionRanges);
      }

      const nextSourceInteraction = sourceInteractionEffect(transaction);
      if (nextSourceInteraction) {
        return {
          ...preview,
          sourceInteractionRanges: addSourceInteractionRange(preview.sourceInteractionRanges, nextSourceInteraction)
        };
      }

      const clearedSourceInteraction = clearSourceInteractionEffect(transaction);
      if (clearedSourceInteraction) {
        testHooks?.onRebuild?.("selection");
        return buildCodeBlockPreviewDecorations(
          transaction.state,
          t,
          preview.visibleRanges,
          preview.editorHasFocus,
          removeSourceInteractionRange(preview.sourceInteractionRanges, clearedSourceInteraction)
        );
      }

      if (transaction.docChanged) {
        if (canMapCodeBlockDecorations(transaction, preview.decorations)) {
          return {
            decorations: preview.decorations.map(transaction.changes),
            editorHasFocus: preview.editorHasFocus,
            revealedRanges: mapSyntaxBlockRanges(transaction.changes, preview.revealedRanges),
            sourceInteractionRanges: mapSyntaxBlockRanges(transaction.changes, preview.sourceInteractionRanges),
            visibleRanges: mapSyntaxBlockRanges(transaction.changes, preview.visibleRanges)
          };
        }

        testHooks?.onRebuild?.("docChanged");
        return buildCodeBlockPreviewDecorations(transaction.state, t, preview.visibleRanges, preview.editorHasFocus, preview.sourceInteractionRanges);
      }

      if (transaction.selection && shouldRebuildCodeBlockDecorationsForSelection(transaction.state, preview)) {
        testHooks?.onRebuild?.("selection");
        return buildCodeBlockPreviewDecorations(
          transaction.state,
          t,
          preview.visibleRanges,
          preview.editorHasFocus,
          activeSourceInteractionRanges(transaction.state, preview.sourceInteractionRanges)
        );
      }

      return preview;
    },
    provide: (field) => EditorView.decorations.from(field, (preview) => preview.decorations)
  });

  const viewportSync = ViewPlugin.fromClass(
    class {
      private visibleRangesKey = "";

      constructor(view: EditorView) {
        this.scheduleVisibleRangeSync(view);
      }

      update(update: ViewUpdate): void {
        if (update.viewportChanged || update.docChanged) this.scheduleVisibleRangeSync(update.view);
      }

      private scheduleVisibleRangeSync(view: EditorView): void {
        const visibleRanges = visibleRangesForView(view);
        const nextKey = visibleRangeKey(visibleRanges);
        if (nextKey === this.visibleRangesKey) return;

        this.visibleRangesKey = nextKey;
        queueMicrotask(() => {
          if (!view.dom.isConnected) return;
          view.dispatch({ effects: codeBlockPreviewVisibleRangesEffect.of(visibleRangesForView(view)) });
        });
      }
    }
  );

  return [
    field,
    viewportSync,
    EditorView.focusChangeEffect.of((_state, focusing) => codeBlockPreviewFocusEffect.of(focusing))
  ];
}

export function buildLivePreviewDecorations(
  view: EditorView,
  onOpenClickableLink?: (link: ClickableLinkAtPosition) => void,
  t: Translator = createTranslator("system"),
  workspacePath?: string | null,
  sourcePath?: string
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
        const src = resolveWorkspaceImageSrc(match.href, workspacePath);
        if (src) {
          addWidget(match.from, match.to, new ImageWidget(src, match.content ?? ""));
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
