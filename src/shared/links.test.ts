import { describe, expect, it } from "vitest";

import { normalizeWikiLinkTarget, parseWikiLinks } from "./links";

describe("parseWikiLinks", () => {
  it("内部リンクを解析する", () => {
    expect(parseWikiLinks("[[ノート]]")).toEqual([
      {
        alias: null,
        blockId: null,
        heading: null,
        kind: "link",
        raw: "[[ノート]]",
        target: "ノート.md"
      }
    ]);
  });

  it("エイリアス・見出し・ブロック参照を分解する", () => {
    expect(parseWikiLinks("[[folder/note#見出し|表示名]] [[note^abc123]]")).toEqual([
      {
        alias: "表示名",
        blockId: null,
        heading: "見出し",
        kind: "link",
        raw: "[[folder/note#見出し|表示名]]",
        target: "folder/note.md"
      },
      {
        alias: null,
        blockId: "abc123",
        heading: null,
        kind: "link",
        raw: "[[note^abc123]]",
        target: "note.md"
      }
    ]);
  });

  it("ファイル埋め込みをリンクと区別する", () => {
    expect(parseWikiLinks("![[埋め込み]]")[0]).toMatchObject({
      kind: "embed",
      target: "埋め込み.md"
    });
  });

  it("コードブロック内のリンク記法は無視する", () => {
    expect(parseWikiLinks("```md\n[[無視]]\n```\n[[拾う]]").map((link) => link.target)).toEqual([
      "拾う.md"
    ]);
  });
});

describe("normalizeWikiLinkTarget", () => {
  it(".md拡張子を補完し、区切り文字を正規化する", () => {
    expect(normalizeWikiLinkTarget("folder\\note")).toBe("folder/note.md");
    expect(normalizeWikiLinkTarget("note.md")).toBe("note.md");
  });
});
