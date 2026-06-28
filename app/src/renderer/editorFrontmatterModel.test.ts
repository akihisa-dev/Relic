import { describe, expect, it } from "vitest";

import {
  formatDateForInput,
  inputPlaceholderForDateFormat,
  parseChronicleYearInput,
  parseDateInput,
  parseDateInputForFormat,
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

  it("固定フィールドと登録済みフィールドを仕様どおり書き戻す", () => {
    expect(serializeData({
      aliases: ["帝都", "王都"],
      chronicle: [["メイン暦", [[1185, null], [1333, 8]]]],
      custom: ["A", "B"],
      tags: ["資料"]
    }, [{ name: "custom", type: "multi-select" }])).toBe([
      "aliases: [\"帝都\", \"王都\"]",
      "chronicle:",
      "  - [メイン暦, [[1185, null], [1333, 8]]]",
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

  it("フロントマター日付入力は設定した表示順で表示し、保存用にはYYYY-MM-DDへ戻す", () => {
    expect(formatDateForInput("2026-05-20", "ymd")).toBe("2026-05-20");
    expect(formatDateForInput("2026-05-20", "mdy")).toBe("05/20/2026");
    expect(formatDateForInput("2026-05-20", "dmy")).toBe("20/05/2026");
    expect(formatDateForInput("2026-05-20", "system")).toBe("2026-05-20");
    expect(parseDateInputForFormat("05/20/2026", "mdy")).toBe("2026-05-20");
    expect(parseDateInputForFormat("20/05/2026", "dmy")).toBe("2026-05-20");
    expect(parseDateInputForFormat("2026-05-20", "mdy")).toBe("2026-05-20");
    expect(parseDateInputForFormat("20/05/2026", "ymd")).toBeNull();
    expect(inputPlaceholderForDateFormat("mdy")).toBe("MM/DD/YYYY");
  });

  it("chronicle入力は0以外の整数だけ受け付ける", () => {
    expect(parseChronicleYearInput("1185")).toBe(1185);
    expect(parseChronicleYearInput("-300")).toBeNull();
    expect(parseChronicleYearInput("0")).toBeNull();
    expect(parseChronicleYearInput("1.5")).toBeNull();
    expect(parseChronicleYearInput("year")).toBeNull();
  });

  it("サブ暦のchronicle入力は0以下の整数も受け付ける", () => {
    expect(parseChronicleYearInput("-300", true)).toBe(-300);
    expect(parseChronicleYearInput("0", true)).toBe(0);
    expect(parseChronicleYearInput("1185", true)).toBe(1185);
    expect(parseChronicleYearInput("1.5", true)).toBeNull();
    expect(parseChronicleYearInput("year", true)).toBeNull();
  });
});
