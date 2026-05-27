import { StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface MermaidEditRange {
  from: number;
  to: number;
}

export const setMermaidEditRangeEffect = StateEffect.define<MermaidEditRange | null>({
  map: (value, mapping) => {
    if (!value) return null;

    return {
      from: mapping.mapPos(value.from, 1),
      to: mapping.mapPos(value.to, -1)
    };
  }
});

export const mermaidEditRangeField = StateField.define<MermaidEditRange | null>({
  create: () => null,
  update: (value, transaction) => {
    if (value && transaction.docChanged) {
      value = {
        from: transaction.changes.mapPos(value.from, 1),
        to: transaction.changes.mapPos(value.to, -1)
      };
    }

    for (const effect of transaction.effects) {
      if (effect.is(setMermaidEditRangeEffect)) value = effect.value;
    }

    if (!value) return null;
    if (!isValidRange(transaction.state, value)) return null;
    if (!selectionIntersectsRange(transaction.state, value)) return null;

    return value;
  }
});

export function enterMermaidSourceEdit(
  view: EditorView,
  range: MermaidEditRange,
  cursorPosition: number
): void {
  view.dispatch({
    effects: setMermaidEditRangeEffect.of(range),
    scrollIntoView: true,
    selection: { anchor: cursorPosition }
  });
  view.focus();
}

function isValidRange(state: EditorState, range: MermaidEditRange): boolean {
  if (range.from < 0 || range.to > state.doc.length || range.from >= range.to) return false;

  const firstLine = state.doc.lineAt(range.from);
  const lastLine = state.doc.lineAt(range.to);

  return /^\s*```\s*mermaid(?:\s|$)/i.test(firstLine.text) && /^\s*```/.test(lastLine.text);
}

function selectionIntersectsRange(state: EditorState, range: MermaidEditRange): boolean {
  return state.selection.ranges.some((selectionRange) => {
    if (selectionRange.empty) return selectionRange.from >= range.from && selectionRange.from <= range.to;
    return selectionRange.from <= range.to && selectionRange.to >= range.from;
  });
}
