import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { GFM } from "@lezer/markdown";
import { beforeEach, describe, expect, it } from "vitest";

import {
  __getHeadingFoldVisitedNodesForTests,
  __resetHeadingFoldVisitedNodesForTests,
  headingFoldRange
} from "./editorHeadingFolding";

describe("editorHeadingFolding", () => {
  beforeEach(() => {
    __resetHeadingFoldVisitedNodesForTests();
  });

  it("文書後半の見出しでも先頭から行走査せず構文木の対象範囲だけを調べる", async () => {
    const prefix = Array.from({ length: 100 }, (_, index) => `本文 ${index}`).join("\n");
    const content = `${prefix}\n# Target\nsection\n## Child\nchild\n# Next\ntail`;
    const targetFrom = content.indexOf("# Target");
    const state = EditorState.create({
      doc: content,
      extensions: markdown({ extensions: GFM })
    });
    await ensureSyntaxTree(state, state.doc.length, 1000);

    const range = headingFoldRange(state, targetFrom);
    expect(range).toEqual({
      from: targetFrom + "# Target".length,
      to: content.indexOf("# Next") - 1
    });
    expect(__getHeadingFoldVisitedNodesForTests()).toBeLessThan(30);
  });

  it("コードフェンス内の見出しを折りたたみ対象にしない", async () => {
    const content = "```md\n# code heading\n```\n# Real\nbody";
    const state = EditorState.create({ doc: content, extensions: markdown({ extensions: GFM }) });
    await ensureSyntaxTree(state, state.doc.length, 100);

    expect(headingFoldRange(state, content.indexOf("# code"))).toBeNull();
    expect(headingFoldRange(state, content.indexOf("# Real"))).not.toBeNull();
  });
});
