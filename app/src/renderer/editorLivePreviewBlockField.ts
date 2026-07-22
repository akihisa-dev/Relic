import { ChangeSet, StateEffect, StateField, type EditorState, type Text, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

import { diagramLanguageFor } from "./diagramLanguage";
import {
  blockMathRangesInVisibleRanges,
  blockSource,
  codeBlockFenceRanges,
  fencedCodeBlocksInVisibleRanges,
  normalizeVisibleRanges,
  sortedUniqueRanges,
  type SyntaxBlockRange
} from "./editorLivePreviewBlocks";
import {
  clearCodeBlockSourceInteractionEffect,
  codeBlockSourceInteractionEffect,
  CodeBlockWidget,
  MathWidget
} from "./editorLivePreviewWidgets";
import { createTranslator, type Translator } from "./i18nModel";
import { editorHeavyUpdateDelay } from "./editorComplexity";
import { scheduleEditorFrameEffect } from "./editorFrameUpdates";

interface CodeBlockPreviewState {
  decorations: DecorationSet;
  dirty: boolean;
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
const codeBlockPreviewRefreshEffect = StateEffect.define<null>();

/** @internal Test-only access to drive visible range rebuilds without a browser viewport. */
export const __codeBlockPreviewVisibleRangesEffectForTests = codeBlockPreviewVisibleRangesEffect;
/** @internal Test-only access to complete a deferred structural rebuild. */
export const __codeBlockPreviewRefreshEffectForTests = codeBlockPreviewRefreshEffect;

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
    dirty: false,
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

function requestsCodeBlockRefresh(transaction: Transaction): boolean {
  return transaction.effects.some((effect) => effect.is(codeBlockPreviewRefreshEffect));
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

      if (preview.dirty && requestsCodeBlockRefresh(transaction)) {
        testHooks?.onRebuild?.("docChanged");
        return buildCodeBlockPreviewDecorations(
          transaction.state,
          t,
          preview.visibleRanges,
          preview.editorHasFocus,
          preview.sourceInteractionRanges
        );
      }

      if (transaction.docChanged) {
        if (canMapCodeBlockDecorations(transaction, preview.decorations)) {
          return {
            decorations: preview.decorations.map(transaction.changes),
            dirty: preview.dirty,
            editorHasFocus: preview.editorHasFocus,
            revealedRanges: mapSyntaxBlockRanges(transaction.changes, preview.revealedRanges),
            sourceInteractionRanges: mapSyntaxBlockRanges(transaction.changes, preview.sourceInteractionRanges),
            visibleRanges: mapSyntaxBlockRanges(transaction.changes, preview.visibleRanges)
          };
        }

        return {
          decorations: preview.decorations.map(transaction.changes),
          dirty: true,
          editorHasFocus: preview.editorHasFocus,
          revealedRanges: mapSyntaxBlockRanges(transaction.changes, preview.revealedRanges),
          sourceInteractionRanges: mapSyntaxBlockRanges(transaction.changes, preview.sourceInteractionRanges),
          visibleRanges: mapSyntaxBlockRanges(transaction.changes, preview.visibleRanges)
        };
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
        if (update.docChanged) {
          scheduleEditorFrameEffect(
            update.view,
            "code-block-refresh",
            () => codeBlockPreviewRefreshEffect.of(null),
            editorHeavyUpdateDelay(update.state.doc, update.view.visibleRanges)
          );
        }
      }

      private scheduleVisibleRangeSync(view: EditorView): void {
        const visibleRanges = visibleRangesForView(view);
        const nextKey = visibleRangeKey(visibleRanges);
        if (nextKey === this.visibleRangesKey) return;

        this.visibleRangesKey = nextKey;
        scheduleEditorFrameEffect(
          view,
          "code-block-visible-ranges",
          () => codeBlockPreviewVisibleRangesEffect.of(visibleRangesForView(view)),
          editorHeavyUpdateDelay(view.state.doc, visibleRanges)
        );
      }
    }
  );

  return [
    field,
    viewportSync,
    EditorView.focusChangeEffect.of((_state, focusing) => codeBlockPreviewFocusEffect.of(focusing))
  ];
}
