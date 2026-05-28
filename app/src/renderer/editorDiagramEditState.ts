import { StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import { diagramLanguageFor } from "./diagramLanguage";
import { isClosingBacktickFence, parseBacktickOpeningFence } from "./markdownCodeFence";

export interface DiagramEditRange {
  from: number;
  to: number;
}

const setDiagramEditRangeEffect = StateEffect.define<DiagramEditRange | null>({
  map: (value, mapping) => {
    if (!value) return null;

    return {
      from: mapping.mapPos(value.from, 1),
      to: mapping.mapPos(value.to, -1)
    };
  }
});

export const diagramEditRangeField = StateField.define<DiagramEditRange | null>({
  create: () => null,
  update: (value, transaction) => {
    if (value && transaction.docChanged) {
      value = {
        from: transaction.changes.mapPos(value.from, 1),
        to: transaction.changes.mapPos(value.to, -1)
      };
    }

    for (const effect of transaction.effects) {
      if (effect.is(setDiagramEditRangeEffect)) value = effect.value;
    }

    if (!value) return null;
    if (!isValidRange(transaction.state, value)) return null;
    if (!selectionIntersectsRange(transaction.state, value)) return null;

    return value;
  }
});

export function enterDiagramSourceEdit(
  view: EditorView,
  range: DiagramEditRange,
  cursorPosition: number
): void {
  view.dispatch({
    effects: setDiagramEditRangeEffect.of(range),
    scrollIntoView: true,
    selection: { anchor: cursorPosition }
  });
  view.focus();
}

function isValidRange(state: EditorState, range: DiagramEditRange): boolean {
  if (range.from < 0 || range.to > state.doc.length || range.from >= range.to) return false;

  const firstLine = state.doc.lineAt(range.from);
  const lastLine = state.doc.lineAt(range.to);
  const openingFence = parseBacktickOpeningFence(firstLine.text);

  return Boolean(
    openingFence &&
    diagramLanguageFor(openingFence.language) &&
    isClosingBacktickFence(lastLine.text, openingFence.markerLength)
  );
}

function selectionIntersectsRange(state: EditorState, range: DiagramEditRange): boolean {
  return state.selection.ranges.some((selectionRange) => {
    if (selectionRange.empty) return selectionRange.from >= range.from && selectionRange.from <= range.to;
    return selectionRange.from <= range.to && selectionRange.to >= range.from;
  });
}
