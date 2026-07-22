import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { describe, expect, it } from "vitest";

import {
  __getVisitedCodeFenceNodesForTests,
  __resetVisitedCodeFenceNodesForTests,
  isPositionInFencedCodeBlock,
  rangeIntersectsFencedCodeBlock
} from "./markdownCodeBlockRanges";

function state(content: string): EditorState {
  return EditorState.create({
    doc: content,
    extensions: [markdown({ extensions: GFM })]
  });
}

describe("markdownCodeBlockRanges", () => {
  it("入力補助では閉じフェンスがない範囲もコードブロックとして扱う", () => {
    const content = "```\n本文\n追記";
    const editorState = state(content);

    expect(isPositionInFencedCodeBlock(editorState, content.length)).toBe(true);
    expect(rangeIntersectsFencedCodeBlock(editorState, 0, content.length)).toBe(true);
  });

  it("対応する閉じフェンスがある範囲だけをコードブロック扱いする", () => {
    const content = "```\n本文\n```\n通常文";
    const editorState = state(content);

    expect(isPositionInFencedCodeBlock(editorState, content.indexOf("本文"))).toBe(true);
    expect(isPositionInFencedCodeBlock(editorState, content.indexOf("通常文"))).toBe(false);
    expect(rangeIntersectsFencedCodeBlock(editorState, 0, "```\n本文\n```".length)).toBe(true);
  });

  it("文書先頭の行数に関係なく対象位置の構文木祖先だけを確認する", () => {
    const content = `${"通常文\n".repeat(1500)}\`\`\`\ncode\n\`\`\``;
    const editorState = state(content);
    __resetVisitedCodeFenceNodesForTests();

    expect(isPositionInFencedCodeBlock(editorState, content.indexOf("code"))).toBe(true);
    expect(__getVisitedCodeFenceNodesForTests()).toBeLessThan(20);
  });
});
