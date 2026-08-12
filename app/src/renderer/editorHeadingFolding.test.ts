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
    expect(await ensureSyntaxTree(state, state.doc.length, 5000)).not.toBeNull();

    const range = headingFoldRange(state, targetFrom);
    expect(range).toEqual({
      from: targetFrom + "# Target".length,
      to: content.indexOf("# Next") - 1
    });
    expect(__getHeadingFoldVisitedNodesForTests()).toBeLessThan(30);
  });

  it("未構築の構文木を対象範囲まで進めた戻り値から折りたたみ範囲を求める", () => {
    const targetLine = 1000;
    const lines = Array.from({ length: 5000 }, (_, index) => (
      index === targetLine
        ? "# Target"
        : index === targetLine + 3
          ? "# Next"
          : `- **row ${index}** [x](url) \`code\``
    ));
    const content = lines.join("\n");
    const state = EditorState.create({
      doc: content,
      extensions: markdown({ extensions: GFM })
    });
    const targetFrom = content.indexOf("# Target");
    const scanTo = state.doc.line(targetLine + 2001).to;
    expect(ensureSyntaxTree(state, scanTo, 5000)).not.toBeNull();

    expect(headingFoldRange(state, targetFrom)).toEqual({
      from: targetFrom + "# Target".length,
      to: content.indexOf("# Next") - 1
    });
    expect(__getHeadingFoldVisitedNodesForTests()).toBeLessThan(100);
  });

  it("コードフェンス内の見出しを折りたたみ対象にしない", async () => {
    const content = "```md\n# code heading\n```\n# Real\nbody";
    const state = EditorState.create({ doc: content, extensions: markdown({ extensions: GFM }) });
    expect(await ensureSyntaxTree(state, state.doc.length, 5000)).not.toBeNull();

    expect(headingFoldRange(state, content.indexOf("# code"))).toBeNull();
    expect(headingFoldRange(state, content.indexOf("# Real"))).not.toBeNull();
  });
});
