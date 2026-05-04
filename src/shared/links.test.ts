import { describe, expect, it } from "vitest";

import {
  normalizeWikiLinkTarget,
  parseWikiLinks,
  resolveWikiLinkPath,
  resolveWikiLinks
} from "./links";

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

describe("resolveWikiLinkPath", () => {
  it("パスなしリンクはリンク元と同じフォルダに解決する", () => {
    expect(resolveWikiLinkPath("参照先", "folder/source.md")).toBe("folder/参照先.md");
  });

  it("パス付きリンクはワークスペース相対として解決する", () => {
    expect(resolveWikiLinkPath("archive/参照先", "folder/source.md")).toBe("archive/参照先.md");
  });
});

describe("resolveWikiLinks", () => {
  it("リンク先の存在状態と表示名を付与する", () => {
    expect(resolveWikiLinks("[[既存|読む]] [[未作成]]", "notes/source.md", ["notes/既存.md"])).toEqual([
      expect.objectContaining({
        displayName: "読む",
        exists: true,
        path: "notes/既存.md"
      }),
      expect.objectContaining({
        displayName: "未作成",
        exists: false,
        path: "notes/未作成.md"
      })
    ]);
  });
});
