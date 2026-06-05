import { codeFolding, foldEffect, foldedRanges, foldService, unfoldEffect } from "@codemirror/language";
import type { Extension, EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

import type { Translator } from "./i18nModel";
import { isClosingBacktickFence, parseBacktickOpeningFence } from "./markdownCodeFence";

const headingPattern = /^(#{1,6})\s+\S.*$/;
const maxHeadingFoldScanLines = 2000;

function headingLevel(lineText: string): number | null {
  const match = headingPattern.exec(lineText);

  return match ? match[1].length : null;
}

function isInsideBacktickFence(state: EditorState, lineNumber: number): boolean {
  let activeFence: { markerLength: number } | null = null;

  for (let currentLineNumber = 1; currentLineNumber < lineNumber; currentLineNumber += 1) {
    const lineText = state.doc.line(currentLineNumber).text;

    if (activeFence) {
      if (isClosingBacktickFence(lineText, activeFence.markerLength)) activeFence = null;
      continue;
    }

    const openingFence = parseBacktickOpeningFence(lineText);
    if (openingFence) activeFence = { markerLength: openingFence.markerLength };
  }

  return activeFence !== null;
}

export function headingFoldRange(state: EditorState, lineStart: number): { from: number; to: number } | null {
  const doc = state.doc;
  const headingLine = doc.lineAt(lineStart);
  const level = headingLevel(headingLine.text);

  if (level === null || isInsideBacktickFence(state, headingLine.number)) return null;

  let activeFence: { markerLength: number } | null = null;
  let sectionEndLineNumber = headingLine.number;
  const maxLineNumber = Math.min(doc.lines, headingLine.number + maxHeadingFoldScanLines);
  let foundBoundary = false;

  for (let lineNumber = headingLine.number + 1; lineNumber <= maxLineNumber; lineNumber += 1) {
    const line = doc.line(lineNumber);

    if (activeFence) {
      if (isClosingBacktickFence(line.text, activeFence.markerLength)) activeFence = null;
      sectionEndLineNumber = lineNumber;
      continue;
    }

    const nextHeadingLevel = headingLevel(line.text);
    if (nextHeadingLevel !== null && nextHeadingLevel <= level) {
      foundBoundary = true;
      break;
    }

    const openingFence = parseBacktickOpeningFence(line.text);
    if (openingFence) activeFence = { markerLength: openingFence.markerLength };

    sectionEndLineNumber = lineNumber;
  }

  if (!foundBoundary && maxLineNumber < doc.lines) return null;
  if (sectionEndLineNumber <= headingLine.number) return null;

  const from = headingLine.to;
  const to = doc.line(sectionEndLineNumber).to;

  return from < to ? { from, to } : null;
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

      constructor(view: EditorView) {
        this.decorations = buildHeadingFoldDecorations(view, t);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged || update.transactions.some((transaction) => transaction.effects.length > 0)) {
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
