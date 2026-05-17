import { describe, expect, it } from "vitest";

import {
  parseChronicleYearInput,
  parseDateInput,
  serializeData,
  serializeDataPreservingYaml,
  type FrontmatterBlock
} from "./editorFrontmatterModel";

function frontmatterBlock(yamlText: string): FrontmatterBlock {
  return {
    bodyFrom: 0,
    data: {},
    endLine: yamlText.split("\n").length + 2,
    from: 0,
    startLine: 1,
    to: 0,
    yamlText
  };
}

describe("editorFrontmatterModel", () => {
  it("YAMLのコメント、クォート、フィールド順を保持して書き戻す", () => {
    const yamlText = [
      "title: 'Old' # keep",
      "aliases:",
      "  - Alpha",
      "status: todo"
    ].join("\n");

    expect(serializeDataPreservingYaml(frontmatterBlock(yamlText), {
      aliases: ["Alpha", "Beta"],
      status: "done",
      tags: ["資料"],
      title: "New"
    })).toBe([
      "title: 'New' # keep",
      "aliases: [\"Alpha\", \"Beta\"]",
      "status: done",
      "tags: [\"資料\"]"
    ].join("\n"));
  });

  it("ダブルクォートのスカラーも保持する", () => {
    const yamlText = "title: \"Old # text\" # keep";

    expect(serializeDataPreservingYaml(frontmatterBlock(yamlText), {
      title: "New # text"
    })).toBe("title: \"New # text\" # keep");
  });

  it("固定フィールドと登録済みフィールドを1行配列として書き戻す", () => {
    expect(serializeData({
      aliases: ["帝都", "王都"],
      chronicle: [1185, 1333],
      custom: ["A", "B"],
      tags: ["資料"]
    }, [{ name: "custom", type: "multi-select" }])).toBe([
      "aliases: [\"帝都\", \"王都\"]",
      "chronicle: [1185, 1333]",
      "custom: [\"A\", \"B\"]",
      "tags: [\"資料\"]"
    ].join("\n"));
  });

  it("date入力は年月日として存在する日だけ受け付ける", () => {
    expect(parseDateInput("2026-05-20")).toBe("2026-05-20");
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("2026-5-20")).toBeNull();
    expect(parseDateInput("not-date")).toBeNull();
  });

  it("chronicle入力は0以外の整数だけ受け付ける", () => {
    expect(parseChronicleYearInput("1185")).toBe(1185);
    expect(parseChronicleYearInput("-300")).toBe(-300);
    expect(parseChronicleYearInput("0")).toBeNull();
    expect(parseChronicleYearInput("1.5")).toBeNull();
    expect(parseChronicleYearInput("year")).toBeNull();
  });
});
