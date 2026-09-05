import { describe, expect, it } from "vitest";

import { parseMarkdownTags } from "./tags";

describe("parseMarkdownTags", () => {
  it("本文中の#記法はタグとして扱わない", () => {
    expect(parseMarkdownTags("本文 #小説 #キャラ/主人公 #idea-1").tags).toEqual([]);
  });

  it("フロントマターのインライン配列tagsをタグとして解析する", () => {
    expect(
      parseMarkdownTags("---\ntags: [小説, \"キャラ/主人公\"]\n---\n#小説 #資料").tags
    ).toEqual(["キャラ/主人公", "小説"]);
  });

  it("フロントマターのリスト形式tagsを解析する", () => {
    expect(parseMarkdownTags("---\ntags:\n  - 小説\n  - #資料\nstatus: draft\n---\n").frontmatterTags).toEqual([
      "資料",
      "小説"
    ]);
  });

  it("CRLFのフロントマターもタグの正本として解析する", () => {
    expect(parseMarkdownTags("---\r\ntags: [小説, 資料]\r\n---\r\n本文").tags).toEqual([
      "資料",
      "小説"
    ]);
  });

  it("閉じ区切りに続く文字を区切りとして扱わない", () => {
    expect(parseMarkdownTags("---\n---extra\ntags: [後続]\n---\n本文").tags).toEqual(["後続"]);
  });
});
