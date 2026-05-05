import { describe, expect, it } from "vitest";

import {
  parseFrontmatter,
  parseFrontmatterCandidates,
  updateFrontmatter,
  writeFrontmatter
} from "./frontmatter";

describe("parseFrontmatter", () => {
  it("フロントマターを解析する", () => {
    const content = "---\ntitle: Hello\ntags: [a, b]\n---\n本文";
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({ title: "Hello", tags: ["a", "b"] });
    expect(result.body).toBe("本文");
  });

  it("フロントマターがなければ空dataと全体をbodyとして返す", () => {
    const content = "# タイトル\n本文";
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
    expect(result.body).toBe(content);
  });

  it("閉じ区切りがない場合は無効とみなす", () => {
    const content = "---\ntitle: Hello\n本文";
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
  });

  it("不正なYAMLは空dataを返す", () => {
    const content = "---\n: invalid: yaml:\n---\n本文";
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
  });

  it("空のフロントマターは空dataを返す", () => {
    const content = "---\n---\n本文";
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({});
    expect(result.body).toBe("本文");
  });
});

describe("writeFrontmatter", () => {
  it("dataからフロントマター付きコンテンツを生成する", () => {
    const result = writeFrontmatter("本文", { title: "Hello", tags: ["a", "b"] });

    expect(result).toContain("---\n");
    expect(result).toContain("title: Hello");
    expect(result).toContain("本文");
  });

  it("dataが空の場合はbodyをそのまま返す", () => {
    const result = writeFrontmatter("本文", {});

    expect(result).toBe("本文");
  });
});

describe("updateFrontmatter", () => {
  it("既存フロントマターを更新する", () => {
    const content = "---\ntitle: Old\n---\n本文";
    const result = updateFrontmatter(content, (data) => ({ ...data, title: "New" }));
    const parsed = parseFrontmatter(result);

    expect(parsed.data.title).toBe("New");
    expect(parsed.body).toBe("本文");
  });

  it("フロントマターがない場合に新規作成する", () => {
    const content = "本文";
    const result = updateFrontmatter(content, (data) => ({ ...data, tags: ["x"] }));
    const parsed = parseFrontmatter(result);

    expect(parsed.data.tags).toEqual(["x"]);
    expect(parsed.body).toBe("本文");
  });
});

describe("parseFrontmatterCandidates", () => {
  it("frontmatter.mdから候補を読み込む", () => {
    const content = "# フロントマター候補\n\n## status\n- draft\n- review\n- published\n\n## author\n- 自分\n";
    const result = parseFrontmatterCandidates(content);

    expect(result.get("status")).toEqual(["draft", "review", "published"]);
    expect(result.get("author")).toEqual(["自分"]);
  });

  it("候補がない場合は空のMapを返す", () => {
    const result = parseFrontmatterCandidates("# 何もない");

    expect(result.size).toBe(0);
  });
});
