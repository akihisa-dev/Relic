import { describe, expect, it } from "vitest";

import {
  applyUnlinkedReferenceToMarkdown,
  collectUnlinkedReferencesInMarkdown
} from "./unlinkedReferencesModel";

describe("collectUnlinkedReferencesInMarkdown", () => {
  it("本文中のファイル名一致箇所を未リンク参照として集める", () => {
    const references = collectUnlinkedReferencesInMarkdown("Target について\n[[Target]] はリンク済み", {
      existingMarkdownPaths: ["Target.md", "source.md"],
      sourcePath: "source.md",
      targetPath: "Target.md"
    });

    expect(references).toEqual([
      {
        from: 0,
        lineNumber: 1,
        lineText: "Target について",
        linkText: "[[Target]]",
        matchText: "Target",
        sourceName: "source",
        sourcePath: "source.md",
        targetPath: "Target.md",
        to: 6
      }
    ]);
  });

  it("コードブロックとMarkdownリンク内の文字列は候補にしない", () => {
    const references = collectUnlinkedReferencesInMarkdown(
      "```md\nTarget\n```\n[Target](Target.md)\n通常の Target",
      {
        existingMarkdownPaths: ["Target.md", "source.md"],
        sourcePath: "source.md",
        targetPath: "Target.md"
      }
    );

    expect(references).toHaveLength(1);
    expect(references[0]?.lineText).toBe("通常の Target");
  });

  it("同名ファイルがありbasenameリンクで解決できない場合は表示名付きのパスリンクにする", () => {
    const references = collectUnlinkedReferencesInMarkdown("Target", {
      existingMarkdownPaths: ["folder/Target.md", "other/Target.md", "source.md"],
      sourcePath: "source.md",
      targetPath: "folder/Target.md"
    });

    expect(references[0]?.linkText).toBe("[[folder/Target|Target]]");
  });
});

describe("applyUnlinkedReferenceToMarkdown", () => {
  it("指定された1件だけを内部リンクへ置き換える", () => {
    const content = "Target と Target";
    const updated = applyUnlinkedReferenceToMarkdown(content, {
      from: 0,
      linkText: "[[Target]]",
      matchText: "Target",
      to: 6
    });

    expect(updated).toBe("[[Target]] と Target");
  });

  it("候補位置の文字列が変わっている場合は置き換えない", () => {
    const updated = applyUnlinkedReferenceToMarkdown("Changed", {
      from: 0,
      linkText: "[[Target]]",
      matchText: "Target",
      to: 6
    });

    expect(updated).toBeNull();
  });
});
