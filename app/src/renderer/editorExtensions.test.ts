import { CompletionContext } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { describe, expect, it, vi } from "vitest";

import { createTranslator } from "./i18nModel";
import { diagramEditRangeField } from "./editorDiagramEditState";
import {
  __codeBlockPreviewVisibleRangesEffectForTests,
  __codeBlockPreviewRefreshEffectForTests,
  createLivePreviewCodeBlockField,
  livePreviewCompositionEndedEffect
} from "./editorLivePreview";
import {
  __tablePreviewVisibleRangesEffectForTests,
  __tablePreviewRefreshEffectForTests,
  createLivePreviewTableField
} from "./editorTables";
import {
  __clearWikiCompletionCache,
  __getWikiCompletionBuildStats,
  buildWikiLinkCompletionSource
} from "./editorExtensions";
import { createLivePreviewDecorationsPlugin } from "./editorLivePreview";

function complete(doc: string, allFilePaths: string[], aliases: string[] = [], position = doc.length) {
  const state = EditorState.create({ doc });
  const source = buildWikiLinkCompletionSource(allFilePaths, { aliases });

  return source(new CompletionContext(state, position, true));
}

describe("buildWikiLinkCompletionSource", () => {
  it("候補生成は入力時初回だけ実行し、2回目はキャッシュを再利用する", () => {
    __clearWikiCompletionCache();
    const allFilePaths = [
      "notes/運命.md",
      "notes/導入.md",
      "notes/概要.md"
    ];
    const aliases = ["エントリーポイント"];
    const resultBefore = complete("[[導", allFilePaths, aliases);

    expect(__getWikiCompletionBuildStats().cacheMisses).toBe(1);
    expect(resultBefore).not.toBeNull();

    const resultAfter = complete("[[導", allFilePaths, aliases);

    expect(__getWikiCompletionBuildStats().cacheHits).toBe(1);
    expect(__getWikiCompletionBuildStats().cacheMisses).toBe(1);
    expect(resultAfter?.options.length).toEqual(resultBefore?.options.length);
  });

  it("ワークスペースキーと同一参照の候補配列なら別インスタンスでも索引を再利用する", () => {
    __clearWikiCompletionCache();
    const allFilePaths = ["notes/導入.md"];
    const aliases = ["alias"];
    const frontmatter = { aliases };
    const source1 = buildWikiLinkCompletionSource(allFilePaths, frontmatter, { workspacePath: "/workspaces/demo" });
    const source2 = buildWikiLinkCompletionSource(allFilePaths, frontmatter, { workspacePath: "/workspaces/demo" });

    expect(source1(new CompletionContext(EditorState.create({ doc: "[[導" }), 3, true))).not.toBeNull();
    expect(__getWikiCompletionBuildStats().cacheMisses).toBe(1);

    expect(source2(new CompletionContext(EditorState.create({ doc: "[[導" }), 3, true))).not.toBeNull();
    expect(__getWikiCompletionBuildStats().cacheHits).toBe(1);
    expect(__getWikiCompletionBuildStats().cacheMisses).toBe(1);
  });

  it("候補が不要な位置では補完索引を構築しない", () => {
    __clearWikiCompletionCache();
    const allFilePaths = ["notes/導入.md"];

    expect(complete("導入", allFilePaths)).toBeNull();
    expect(__getWikiCompletionBuildStats().cacheMisses).toBe(0);

    const source = buildWikiLinkCompletionSource(allFilePaths, {});
    expect(source(new CompletionContext(EditorState.create({ doc: "[[" }), 2, false))).toBeNull();
    expect(__getWikiCompletionBuildStats().cacheMisses).toBe(0);
  });

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

  it("10,000件を超える大量ファイル補完でも候補数を制限し、必要な候補を返す", () => {
    const filePaths = Array.from({ length: 10_500 }, (_, index) => `notes/大量候補${String(index).padStart(5, "0")}.md`);
    const result = complete("[[大量候補099", filePaths, ["大量候補別名"]);

    expect(result?.options.length).toBeLessThanOrEqual(80);
    expect(result?.options[0]).toEqual({
      apply: "大量候補09900]]",
      label: "大量候補09900"
    });
    expect(result?.options.map((option) => option.label)).toContain("大量候補09979");
    expect(result?.options.map((option) => option.label)).not.toContain("大量候補09899");
  }, 15_000);

  it("大量ファイル補完のcontains一致も索引経由で日本語候補を返す", () => {
    const filePaths = Array.from({ length: 10_000 }, (_, index) => `notes/大量候補${String(index).padStart(5, "0")}.md`);
    const result = complete("[[0997", filePaths);

    expect(result?.options.length).toBeLessThanOrEqual(80);
    expect(result?.options.map((option) => option.label)).toContain("大量候補09970");
    expect(result?.options.map((option) => option.label)).toContain("大量候補09979");
    expect(result?.options.map((option) => option.label)).not.toContain("大量候補09899");
  }, 15_000);

  it("NFKC正規化した英数字でもWikiリンク候補を返す", () => {
    const result = complete("[[abc", [
      "資料/ＡＢＣ計画.md",
      "資料/ABD計画.md"
    ]);

    expect(result?.options.map((option) => option.label)).toEqual(["ＡＢＣ計画"]);
  });

  it("コードブロック内ではWikiリンク候補を返さない", () => {
    const doc = "```ts\nconst link = [[王\n```";
    const result = complete(doc, ["世界/王都.md"], [], doc.indexOf("王") + 1);

    expect(result).toBeNull();
  });
});

describe("live preview decoration rebuild quality gates", () => {
  it("通常テキスト入力ではCodeBlock decorationを再構築せずコードブロック編集時だけ再構築する", () => {
    const onRebuild = vi.fn();
    let state = EditorState.create({
      doc: [
        "```ts",
        "const value = 1;",
        "```",
        "",
        "plain"
      ].join("\n"),
      extensions: [
        markdown({ extensions: GFM }),
        createLivePreviewCodeBlockField(createTranslator("ja"), { onRebuild })
      ]
    });
    state = state.update({
      effects: __codeBlockPreviewVisibleRangesEffectForTests.of([{ from: 0, to: state.doc.length }])
    }).state;
    const visibleRebuildCount = onRebuild.mock.calls.length;

    state = state.update({
      changes: { from: state.doc.length, insert: " text" }
    }).state;

    expect(onRebuild).toHaveBeenCalledTimes(visibleRebuildCount);

    state = state.update({
      changes: { from: state.doc.toString().indexOf("value"), insert: "\n" }
    }).state;
    state = state.update({ effects: __codeBlockPreviewRefreshEffectForTests.of(null) }).state;

    expect(onRebuild.mock.calls.map(([reason]) => reason)).toEqual([
      "create",
      "visibleRanges",
      "docChanged"
    ]);
  });

  it("通常テキスト入力ではTable decorationを再構築せず表編集時だけ再構築する", () => {
    const onRebuild = vi.fn();
    let state = EditorState.create({
      doc: [
        "| A | B |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "plain"
      ].join("\n"),
      extensions: [
        markdown({ extensions: GFM }),
        createLivePreviewTableField(createTranslator("ja"), { onRebuild })
      ]
    });
    state = state.update({
      effects: __tablePreviewVisibleRangesEffectForTests.of([{ from: 0, to: state.doc.length }])
    }).state;
    const visibleRebuildCount = onRebuild.mock.calls.length;

    state = state.update({
      changes: { from: state.doc.length, insert: " text" }
    }).state;

    expect(onRebuild).toHaveBeenCalledTimes(visibleRebuildCount);

    state = state.update({
      changes: { from: state.doc.toString().indexOf("1"), insert: "10" }
    }).state;
    state = state.update({ effects: __tablePreviewRefreshEffectForTests.of(null) }).state;

    expect(onRebuild.mock.calls.map(([reason]) => reason)).toEqual([
      "create",
      "visibleRanges",
      "docChanged"
    ]);
  });
});

describe("inline live preview decoration rebuild quality gates", () => {
  it("本文・選択・表示範囲・フォーカスに無関係なtransactionでは再構築しない", () => {
    const rebuilds: string[] = [];
    const state = EditorState.create({
      doc: "**強調**\n本文",
      extensions: [
        diagramEditRangeField,
        createLivePreviewDecorationsPlugin(undefined, undefined, undefined, undefined, 0, {
          onRebuild: (reason) => rebuilds.push(reason)
        })
      ]
    });
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state });

    expect(rebuilds).toEqual(["create"]);
    view.dispatch({ annotations: Transaction.addToHistory.of(false) });
    expect(rebuilds).toEqual(["create"]);

    view.dispatch({ selection: { anchor: 1 } });
    expect(rebuilds).toEqual(["create", "selection"]);

    view.dispatch({ effects: livePreviewCompositionEndedEffect.of(null) });
    expect(rebuilds).toEqual(["create", "selection", "compositionEnd"]);
    view.destroy();
    parent.remove();
  });
});
