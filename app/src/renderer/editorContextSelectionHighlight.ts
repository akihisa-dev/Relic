import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

export const setContextSelectionHighlightEffect = StateEffect.define<{ from: number; to: number } | null>();

export const contextSelectionHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (decorations, transaction) => {
    let nextDecorations = decorations.map(transaction.changes);

    for (const effect of transaction.effects) {
      if (!effect.is(setContextSelectionHighlightEffect)) continue;

      const range = effect.value;
      nextDecorations = range && range.from < range.to
        ? Decoration.set([
          Decoration.mark({ class: "cm-context-selection-highlight" }).range(range.from, range.to)
        ])
        : Decoration.none;
    }

    return nextDecorations;
  },
  provide: (field) => EditorView.decorations.from(field)
});
