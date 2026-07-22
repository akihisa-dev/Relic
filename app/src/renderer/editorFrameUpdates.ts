import { StateEffect, type StateEffect as StateEffectType } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export const editorFrameUpdateEffect = StateEffect.define<null>();

interface PendingEditorFrame {
  delayTimer: ReturnType<typeof setTimeout> | null;
  effects: Map<string, () => StateEffectType<unknown> | null>;
  frame: number | null;
}

const pendingFrames = new WeakMap<EditorView, PendingEditorFrame>();

export function scheduleEditorFrameEffect(
  view: EditorView,
  key: string,
  effect: () => StateEffectType<unknown> | null,
  delay = 0
): void {
  let pending = pendingFrames.get(view);
  if (!pending) {
    pending = { delayTimer: null, effects: new Map(), frame: null };
    pendingFrames.set(view, pending);
  }
  pending.effects.set(key, effect);

  if (delay > 0 && pending.frame === null) {
    if (pending.delayTimer) clearTimeout(pending.delayTimer);
    pending.delayTimer = setTimeout(() => {
      pending!.delayTimer = null;
      requestEditorFrame(view, pending!);
    }, delay);
    return;
  }

  if (pending.delayTimer) {
    clearTimeout(pending.delayTimer);
    pending.delayTimer = null;
  }
  requestEditorFrame(view, pending);
}

export function cancelEditorFrameUpdates(view: EditorView): void {
  const pending = pendingFrames.get(view);
  if (!pending) return;
  if (pending.delayTimer) clearTimeout(pending.delayTimer);
  if (pending.frame !== null) cancelAnimationFrame(pending.frame);
  pendingFrames.delete(view);
}

function requestEditorFrame(view: EditorView, pending: PendingEditorFrame): void {
  if (pending.frame !== null) return;
  pending.frame = requestAnimationFrame(() => {
    pending.frame = null;
    if (!view.dom.isConnected) {
      pending.effects.clear();
      pendingFrames.delete(view);
      return;
    }

    const effects = Array.from(pending.effects.values(), (factory) => factory()).filter(
      (effect): effect is StateEffectType<unknown> => effect !== null
    );
    pending.effects.clear();
    view.dispatch({ effects: [editorFrameUpdateEffect.of(null), ...effects] });
  });
}
