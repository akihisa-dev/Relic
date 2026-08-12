import { describe, expect, it } from "vitest";

import {
  parseFrontmatter,
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

  it("CRLFのフロントマターを本文先頭に改行を残さず解析する", () => {
    const content = "---\r\ntitle: Hello\r\n---\r\n本文";
    const result = parseFrontmatter(content);

    expect(result.data).toEqual({ title: "Hello" });
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

  it("危険なprototypeキーを含むYAMLを無効として扱う", () => {
    const result = parseFrontmatter("---\n__proto__:\n  polluted: true\n---\n本文");

    expect(result.data).toEqual({});
    expect(result.body).toContain("__proto__");
  });

  it("YAMLの過大な本文を解析せず無効として扱う", () => {
    const content = `---\nvalue: ${"x".repeat(1_048_577)}\n---\n本文`;

    expect(parseFrontmatter(content).data).toEqual({});
  });

  it("flow YAMLの深いnestingとalias展開後の深いkeyを無効にする", () => {
    const nested = Array.from({ length: 66 }, (_, index) => `[${index}: `).join("") + "value" + "]".repeat(66);
    expect(parseFrontmatter(`---\nvalue: ${nested}\n---\n本文`).data).toEqual({});
    const deepKey = `${"  ".repeat(65)}__proto__: { polluted: true }`;
    expect(parseFrontmatter(`---\nroot:\n${deepKey}\n---\n本文`).data).toEqual({});
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
