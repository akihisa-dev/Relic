import { codeFolding, foldEffect, foldedRanges, foldService, syntaxTree, unfoldEffect } from "@codemirror/language";
import type { Extension, EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

import type { Translator } from "./i18nModel";
import { editorHeavyUpdateDelay } from "./editorComplexity";
import { editorFrameUpdateEffect, scheduleEditorFrameEffect } from "./editorFrameUpdates";

const headingPattern = /^(#{1,6})\s+\S.*$/;
const maxHeadingFoldScanLines = 2000;

function headingLevel(lineText: string): number | null {
  const match = headingPattern.exec(lineText);

  return match ? match[1].length : null;
}

let headingFoldVisitedNodes = 0;

export function headingFoldRange(state: EditorState, lineStart: number): { from: number; to: number } | null {
  const doc = state.doc;
  const headingLine = doc.lineAt(lineStart);
  const level = headingLevel(headingLine.text);

  if (level === null) return null;

  const maxLineNumber = Math.min(doc.lines, headingLine.number + maxHeadingFoldScanLines);
  const scanTo = doc.line(maxLineNumber).to;
  let currentHeadingFound = false;
  let boundaryFrom: number | null = null;
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.to < headingLine.from || node.from > scanTo || boundaryFrom !== null) return false;
      headingFoldVisitedNodes += 1;
      const nodeLevel = headingNodeLevel(node.name);
      if (nodeLevel === null) return;
      if (node.from === headingLine.from) {
        currentHeadingFound = true;
        return false;
      }
      if (currentHeadingFound && node.from > headingLine.from && nodeLevel <= level) {
        boundaryFrom = node.from;
      }
      return false;
    },
    from: headingLine.from,
    to: scanTo
  });

  if (!currentHeadingFound) return null;
  if (boundaryFrom === null && maxLineNumber < doc.lines) return null;
  const sectionEndLineNumber = boundaryFrom === null
    ? maxLineNumber
    : doc.lineAt(boundaryFrom).number - 1;
  if (sectionEndLineNumber <= headingLine.number) return null;

  const from = headingLine.to;
  const to = doc.line(sectionEndLineNumber).to;

  return from < to ? { from, to } : null;
}

function headingNodeLevel(name: string): number | null {
  const match = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
  return match ? Number(match[1]) : null;
}

/** @internal Test-only counter for deterministic scan assertions. */
export function __getHeadingFoldVisitedNodesForTests(): number {
  return headingFoldVisitedNodes;
}

/** @internal Test-only reset for deterministic scan assertions. */
export function __resetHeadingFoldVisitedNodesForTests(): void {
  headingFoldVisitedNodes = 0;
}

function foldedHeadingRange(state: EditorState, range: { from: number; to: number }): { from: number; to: number } | null {
  let foldedRange: { from: number; to: number } | null = null;

  foldedRanges(state).between(range.from, range.to, (from, to) => {
    if (from === range.from && to === range.to) foldedRange = { from, to };
  });

  return foldedRange;
}

class HeadingFoldWidget extends WidgetType {
  constructor(
    private readonly folded: boolean,
    private readonly range: { from: number; to: number },
    private readonly t: Translator
  ) {
    super();
  }

  override eq(other: HeadingFoldWidget): boolean {
    return this.folded === other.folded && this.range.from === other.range.from && this.range.to === other.range.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const marker = document.createElement("button");
    marker.className = `cm-heading-fold-marker${this.folded ? " cm-heading-fold-marker--closed" : " cm-heading-fold-marker--open"}`;
    marker.textContent = this.folded ? "▸" : "▾";
    marker.type = "button";
    marker.setAttribute("aria-label", this.folded ? this.t("editor.unfoldHeading") : this.t("editor.foldHeading"));
    marker.title = this.folded ? this.t("editor.unfoldHeading") : this.t("editor.foldHeading");
    marker.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const foldedRange = foldedHeadingRange(view.state, this.range);

      view.dispatch({
        effects: foldedRange ? unfoldEffect.of(foldedRange) : foldEffect.of(this.range)
      });
      view.focus();
    });

    return marker;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

function buildHeadingFoldDecorations(view: EditorView, t: Translator): DecorationSet {
  const ranges: Array<{ from: number; deco: Decoration }> = [];
  const doc = view.state.doc;

  for (const { from: visibleFrom, to: visibleTo } of view.visibleRanges) {
    const fromLine = doc.lineAt(visibleFrom).number;
    const toLine = doc.lineAt(visibleTo).number;

    for (let lineNumber = fromLine; lineNumber <= toLine; lineNumber += 1) {
      const line = doc.line(lineNumber);
      const range = headingFoldRange(view.state, line.from);
      if (!range) continue;

      ranges.push({
        from: line.from,
        deco: Decoration.widget({
          side: -1,
          widget: new HeadingFoldWidget(Boolean(foldedHeadingRange(view.state, range)), range, t)
        })
      });
    }
  }

  return Decoration.set(ranges.map(({ from, deco }) => deco.range(from)));
}

function createHeadingFoldWidgetPlugin(t: Translator): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      private dirty = false;

      constructor(view: EditorView) {
        this.decorations = buildHeadingFoldDecorations(view, t);
      }

      update(update: ViewUpdate): void {
        const frameUpdate = update.transactions.some((transaction) => (
          transaction.effects.some((effect) => effect.is(editorFrameUpdateEffect))
        ));
        if (update.docChanged) {
          this.decorations = this.decorations.map(update.changes);
          this.dirty = true;
          scheduleEditorFrameEffect(
            update.view,
            "heading-folding",
            () => null,
            editorHeavyUpdateDelay(update.state.doc, update.view.visibleRanges)
          );
          return;
        }
        if (update.viewportChanged) {
          this.dirty = true;
          scheduleEditorFrameEffect(update.view, "heading-folding", () => null);
          return;
        }
        if (frameUpdate && this.dirty) {
          this.decorations = buildHeadingFoldDecorations(update.view, t);
          this.dirty = false;
          return;
        }
        if (update.transactions.some((transaction) => transaction.effects.some((effect) => (
          effect.is(foldEffect) || effect.is(unfoldEffect)
        )))) {
          this.decorations = buildHeadingFoldDecorations(update.view, t);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

export function createHeadingFoldingExtension(t: Translator): Extension {
  return [
    foldService.of((state, lineStart) => headingFoldRange(state, lineStart)),
    codeFolding({ placeholderText: "…" }),
    createHeadingFoldWidgetPlugin(t)
  ];
}
