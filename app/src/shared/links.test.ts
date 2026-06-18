import { describe, expect, it } from "vitest";

import {
  createWikiLinkResolver,
  formatWikiLink,
  normalizeWikiLinkTarget,
  parseWikiLinks,
  resolveMarkdownLinkPath,
  resolveWikiLinkPath,
  resolveWikiLinkPathWithAliases,
  resolveWikiLinks,
  scanWikiLinks
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

  it("inline code、チルダフェンス、インデントコード内のリンク記法は無視する", () => {
    const markdown = [
      "`[[inline]]`",
      "~~~",
      "[[tilde]]",
      "~~~",
      "    [[indent]]",
      "[[拾う]]"
    ].join("\n");

    expect(parseWikiLinks(markdown).map((link) => link.target)).toEqual(["拾う.md"]);
  });
});

describe("scanWikiLinks", () => {
  it("リンク本文とMarkdown内の位置を共通形式で返す", () => {
    const markdown = "before ![[folder/note#見出し^abc|表示]] after";
    const [match] = scanWikiLinks(markdown);

    expect(match).toMatchObject({
      alias: "表示",
      blockId: "abc",
      body: "folder/note#見出し^abc|表示",
      bodyFrom: markdown.indexOf("folder/note"),
      bodyTo: markdown.indexOf("]]"),
      from: markdown.indexOf("![["),
      heading: "見出し",
      kind: "embed",
      raw: "![[folder/note#見出し^abc|表示]]",
      rawTargetBase: "folder/note",
      target: "folder/note.md",
      targetBase: "folder/note.md",
      to: markdown.indexOf(" after")
    });
  });

  it("limit指定時は上限到達後に解析を止める", () => {
    const markdown = Array.from({ length: 10_000 }, (_, index) => `[[Note${index}]]`).join(" ");

    const matches = scanWikiLinks(markdown, { limit: 1001 });

    expect(matches).toHaveLength(1001);
    expect(matches[0].target).toBe("Note0.md");
    expect(matches.at(-1)?.target).toBe("Note1000.md");
  });
});

describe("formatWikiLink", () => {
  it("共通のWikiLink表記で見出し・ブロック・エイリアスを書き戻す", () => {
    expect(formatWikiLink("embed", {
      alias: "表示",
      blockId: "abc",
      heading: "見出し",
      targetBase: "folder/note"
    })).toBe("![[folder/note#見出し^abc|表示]]");
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

describe("resolveMarkdownLinkPath", () => {
  it("相対Markdownリンクをリンク元ファイル基準で解決する", () => {
    expect(resolveMarkdownLinkPath("./child.md#決定事項", "notes/source.md")).toEqual({
      heading: "決定事項",
      path: "notes/child.md"
    });
  });

  it(".md拡張子なしの相対リンクもMarkdownファイルとして解決する", () => {
    expect(resolveMarkdownLinkPath("../drafts/企画", "notes/current/source.md")).toEqual({
      heading: null,
      path: "notes/drafts/企画.md"
    });
  });

  it("外部URLはワークスペース内リンクとして扱わない", () => {
    expect(resolveMarkdownLinkPath("https://example.com", "source.md")).toBeNull();
    expect(resolveMarkdownLinkPath("//example.com/note", "source.md")).toBeNull();
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

  it("リンク先が存在しない場合はaliasesで解決する", () => {
    expect(resolveWikiLinks("[[α]]", "source.md", ["A.md"], { "A.md": ["α", "a"] })).toEqual([
      expect.objectContaining({
        exists: true,
        path: "A.md"
      })
    ]);
  });

  it("パスなしリンクはワークスペース内でファイル名が一意ならそのファイルへ解決する", () => {
    expect(resolveWikiLinks("[[B]]", "indexes/source.md", ["notes/B.md", "A.md"])).toEqual([
      expect.objectContaining({
        exists: true,
        path: "notes/B.md"
      })
    ]);
  });

  it("パスなしリンクは同名ファイルが複数ある場合に一意解決しない", () => {
    expect(resolveWikiLinks("[[B]]", "indexes/source.md", ["archive/B.md", "notes/B.md"])).toEqual([
      expect.objectContaining({
        exists: false,
        path: "indexes/B.md"
      })
    ]);
  });

  it("同じpath集合とalias集合を再利用するresolverを作れる", () => {
    const resolve = createWikiLinkResolver(["A.md", "notes/B.md"], { "notes/B.md": ["bee"] });

    expect(resolve("[[A]] [[bee]]", "source.md").map((link) => link.path)).toEqual(["A.md", "notes/B.md"]);
    expect(resolve("[[B]]", "notes/source.md").map((link) => link.path)).toEqual(["notes/B.md"]);
  });

  it("resolverでもlimit指定時はresolved object生成数を制限する", () => {
    const resolve = createWikiLinkResolver([]);
    const markdown = Array.from({ length: 10_000 }, (_, index) => `[[Note${index}]]`).join(" ");

    expect(resolve(markdown, "source.md", { limit: 1001 })).toHaveLength(1001);
  });
});

describe("resolveWikiLinkPathWithAliases", () => {
  it("既存パスを優先し、存在しないリンクだけaliasesで解決する", () => {
    expect(resolveWikiLinkPathWithAliases("a", "source.md", ["A.md"], { "A.md": ["a"] })).toBe("A.md");
    expect(resolveWikiLinkPathWithAliases("a", "source.md", ["a.md", "A.md"], { "A.md": ["a"] })).toBe("a.md");
  });

  it("パスなしリンクはワークスペース内でファイル名が一意なら開ける", () => {
    expect(resolveWikiLinkPathWithAliases("B", "indexes/source.md", ["notes/B.md"])).toBe("notes/B.md");
  });
});
