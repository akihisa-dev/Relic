import { describe, expect, it } from "vitest";

import { createWikiLinkFormatter } from "./toolWikiLinks";

describe("createWikiLinkFormatter", () => {
  it("通常名は従来どおりWikiリンクを生成する", () => {
    const format = createWikiLinkFormatter(["notes/root.md", "archive/root.md", "archive/other.md"]);

    expect(format("notes/root.md", "root")).toBe("[[./notes/root|root]]");
    expect(format("archive/root.md", "root")).toBe("[[./archive/root|root]]");
  });

  it("安全な文字だけなら同名でもパス付きWikiリンクを生成する", () => {
    const format = createWikiLinkFormatter(["notes/base.md", "archive/base.md"]);

    expect(format("notes/base.md", "base")).toBe("[[./notes/base|base]]");
  });

  it("ファイル名に `]` を含む場合はプレーンテキストにフォールバックする", () => {
    const format = createWikiLinkFormatter(["a]b.md", "normal.md"]);

    expect(format("a]b.md", "a]b")).toBe("a]b");
  });

  it("ファイル名に `|` を含む場合はプレーンテキストにフォールバックする", () => {
    const format = createWikiLinkFormatter(["a|b.md"]);

    expect(format("a|b.md", "a|b")).toBe("a|b");
  });

  it("改行を含む表示名はプレーンテキストに変換して壊れたMarkdownを出さない", () => {
    const format = createWikiLinkFormatter(["safe-name.md"]);

    expect(format("safe-name.md", "line1\nline2")).toBe("line1 line2");
  });

  it("前後空白はプレーンテキストに変換して壊れたWikiリンクを避ける", () => {
    const format = createWikiLinkFormatter(["safe-name.md"]);

    expect(format("safe-name.md", "  safe  ")).toBe("safe");
  });

  it("パスが危険文字を含む重複名リンクもプレーンテキストにフォールバックする", () => {
    const format = createWikiLinkFormatter(["folder/a|b.md", "folder/a|b.md"]);

    expect(format("folder/a|b.md", "a|b")).toBe("a|b");
  });
});
