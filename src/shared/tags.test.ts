import { describe, expect, it } from "vitest";

import { parseMarkdownTags } from "./tags";

describe("parseMarkdownTags", () => {
  it("本文タグ・階層タグ・日本語タグを解析する", () => {
    expect(parseMarkdownTags("本文 #小説 #キャラ/主人公 #idea-1").bodyTags).toEqual([
      "idea-1",
      "キャラ/主人公",
      "小説"
    ]);
  });

  it("コードブロックとインラインコード内のタグは無視する", () => {
    expect(parseMarkdownTags("```md\n#無視\n```\n`#無視2`\n#拾う").bodyTags).toEqual([
      "拾う"
    ]);
  });

  it("フロントマターのインライン配列tagsを本文タグと統合する", () => {
    expect(
      parseMarkdownTags("---\ntags: [小説, \"キャラ/主人公\"]\n---\n#小説 #資料").tags
    ).toEqual(["キャラ/主人公", "資料", "小説"]);
  });

  it("フロントマターのリスト形式tagsを解析する", () => {
    expect(parseMarkdownTags("---\ntags:\n  - 小説\n  - #資料\nstatus: draft\n---\n").frontmatterTags).toEqual([
      "資料",
      "小説"
    ]);
  });
});
