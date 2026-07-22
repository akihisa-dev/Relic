import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editorFrameUpdateEffect, scheduleEditorFrameEffect } from "./editorFrameUpdates";

describe("editorFrameUpdates", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("同一フレームの複数更新を1回のtransactionへまとめ、各キーの最新版だけを使う", async () => {
    vi.useFakeTimers();
    const customEffect = StateEffect.define<number>();
    const transactions: number[][] = [];
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        extensions: EditorView.updateListener.of((update) => {
          const values = update.transactions.flatMap((transaction) => transaction.effects
            .filter((effect) => effect.is(customEffect))
            .map((effect) => effect.value));
          if (update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(editorFrameUpdateEffect)))) {
            transactions.push(values);
          }
        })
      })
    });

    scheduleEditorFrameEffect(view, "table", () => customEffect.of(1));
    scheduleEditorFrameEffect(view, "table", () => customEffect.of(2));
    scheduleEditorFrameEffect(view, "code", () => customEffect.of(3));
    expect(transactions).toEqual([]);

    await vi.runAllTimersAsync();
    expect(transactions).toEqual([[2, 3]]);
    view.destroy();
    parent.remove();
  });
});
