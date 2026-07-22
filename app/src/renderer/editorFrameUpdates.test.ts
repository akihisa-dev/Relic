import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelEditorFrameUpdates, editorFrameUpdateEffect, scheduleEditorFrameEffect } from "./editorFrameUpdates";

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

  it("軽い更新を先に反映しても高負荷更新の待機を解除しない", async () => {
    vi.useFakeTimers();
    const customEffect = StateEffect.define<string>();
    const values: string[][] = [];
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        extensions: EditorView.updateListener.of((update) => {
          const transactionValues = update.transactions.flatMap((transaction) => transaction.effects
            .filter((effect) => effect.is(customEffect))
            .map((effect) => effect.value));
          if (transactionValues.length > 0) values.push(transactionValues);
        })
      })
    });

    scheduleEditorFrameEffect(view, "heavy", () => customEffect.of("old-heavy"), 90);
    scheduleEditorFrameEffect(view, "heavy", () => customEffect.of("latest-heavy"), 90);
    scheduleEditorFrameEffect(view, "cursor", () => customEffect.of("cursor"));
    await vi.advanceTimersByTimeAsync(16);
    expect(values).toEqual([["cursor"]]);

    await vi.advanceTimersByTimeAsync(73);
    expect(values).toEqual([["cursor"]]);
    await vi.advanceTimersByTimeAsync(17);
    expect(values).toEqual([["cursor"], ["latest-heavy"]]);

    cancelEditorFrameUpdates(view);
    view.destroy();
    parent.remove();
  });

  it("破棄時の解除で待機中timerと描画フレームを実行しない", async () => {
    vi.useFakeTimers();
    const customEffect = StateEffect.define<string>();
    const applied: string[] = [];
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        extensions: EditorView.updateListener.of((update) => {
          applied.push(...update.transactions.flatMap((transaction) => transaction.effects
            .filter((effect) => effect.is(customEffect))
            .map((effect) => effect.value)));
        })
      })
    });

    scheduleEditorFrameEffect(view, "cursor", () => customEffect.of("cursor"));
    scheduleEditorFrameEffect(view, "heavy", () => customEffect.of("heavy"), 90);
    cancelEditorFrameUpdates(view);
    await vi.runAllTimersAsync();

    expect(applied).toEqual([]);
    view.destroy();
    parent.remove();
  });
});
