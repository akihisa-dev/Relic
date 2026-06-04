import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { buildWikiLinkCompletionSource } from "./editorExtensions";

function complete(doc: string, allFilePaths: string[], aliases: string[] = []) {
  const state = EditorState.create({ doc });
  const source = buildWikiLinkCompletionSource(allFilePaths, { aliases });

  return source(new CompletionContext(state, doc.length, true));
}

describe("buildWikiLinkCompletionSource", () => {
  it("完全一致、前方一致、部分一致の順でWikiリンク候補を返す", () => {
    const result = complete("[[王", [
      "世界/王都.md",
      "資料/帝都王宮.md",
      "人物/女王.md"
    ]);

    expect(result?.options.map((option) => option.label)).toEqual([
      "王都",
      "女王",
      "帝都王宮"
    ]);
  });

  it("重複basenameはパスで区別し、日本語aliasも候補に含める", () => {
    const result = complete("[[帝都", [
      "世界/帝都.md",
      "下書き/帝都.md",
      "人物/帝国宰相.md"
    ], ["帝都オルスター"]);

    expect(result?.options.map((option) => ({ apply: option.apply, label: option.label }))).toEqual([
      { apply: "下書き/帝都]]", label: "下書き/帝都" },
      { apply: "世界/帝都]]", label: "世界/帝都" },
      { apply: "帝都オルスター]]", label: "帝都オルスター" }
    ]);
  });

  it("ネストしたパスの部分入力でも候補を見つける", () => {
    const result = complete("[[設定/魔", [
      "資料/設定/魔法体系.md",
      "資料/設定/暦.md"
    ]);

    expect(result?.options.map((option) => option.label)).toEqual(["魔法体系"]);
  });
});
