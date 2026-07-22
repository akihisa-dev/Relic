import { StateEffect, type StateEffect as StateEffectType } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export const editorFrameUpdateEffect = StateEffect.define<null>();

interface PendingEditorFrame {
  delayTimer: ReturnType<typeof setTimeout> | null;
  effects: Map<string, PendingEditorEffect>;
  frame: number | null;
}

interface PendingEditorEffect {
  factory: () => StateEffectType<unknown> | null;
  readyAt: number;
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
  pending.effects.set(key, {
    factory: effect,
    readyAt: Date.now() + Math.max(0, delay)
  });
  scheduleNextEditorFrame(view, pending);
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

    const now = Date.now();
    const ready = Array.from(pending.effects.entries()).filter(([, effect]) => effect.readyAt <= now);
    for (const [key] of ready) pending.effects.delete(key);
    const effects = ready.map(([, effect]) => effect.factory()).filter(
      (effect): effect is StateEffectType<unknown> => effect !== null
    );
    if (ready.length > 0) {
      view.dispatch({ effects: [editorFrameUpdateEffect.of(null), ...effects] });
    }
    scheduleNextEditorFrame(view, pending);
  });
}

function scheduleNextEditorFrame(view: EditorView, pending: PendingEditorFrame): void {
  if (pending.delayTimer) {
    clearTimeout(pending.delayTimer);
    pending.delayTimer = null;
  }
  if (pending.effects.size === 0) return;

  const now = Date.now();
  const earliest = Math.min(...Array.from(pending.effects.values(), (effect) => effect.readyAt));
  if (earliest <= now) {
    requestEditorFrame(view, pending);
    return;
  }

  pending.delayTimer = setTimeout(() => {
    pending.delayTimer = null;
    requestEditorFrame(view, pending);
  }, earliest - now);
}
