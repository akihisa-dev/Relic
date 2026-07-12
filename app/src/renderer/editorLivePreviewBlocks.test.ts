import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";

import {
  blockMathRangesInVisibleRanges,
  fencedCodeBlocksInVisibleRanges
} from "./editorLivePreviewBlocks";

function fencedBlocks(content: string) {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })]
  });

  return fencedCodeBlocksInVisibleRanges(state, [{ from: 0, to: state.doc.length }]);
}

function blockMathRanges(content: string) {
  const state = EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })]
  });

  return blockMathRangesInVisibleRanges(state, [{ from: 0, to: state.doc.length }]);
}

describe("editorLivePreviewBlocks", () => {
  it("未完了のコードフェンスはプレビュー対象にしない", () => {
    expect(fencedBlocks("```\n本文")).toEqual([]);
  });

  it("閉じフェンスが文書末尾にない場合はプレビュー対象にしない", () => {
    expect(fencedBlocks("```\n本文\n追記")).toEqual([]);
  });

  it("未完了のコードフェンス内にある数式をプレビュー対象にしない", () => {
    expect(blockMathRanges("```\n$$\n数式\n$$")).toEqual([]);
  });

  it("閉じたコードフェンスだけをプレビュー対象にする", () => {
    expect(fencedBlocks("```\n本文\n```"))
      .toEqual([{ from: 0, to: "```\n本文\n```".length, language: null }]);
  });
});
