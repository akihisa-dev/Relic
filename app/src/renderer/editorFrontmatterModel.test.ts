import { describe, expect, it } from "vitest";

import {
  formatDateForInput,
  inputPlaceholderForDateFormat,
  parseChronicleYearInput,
  parseDateInput,
  parseDateInputForFormat,
  reorderTopLevelYamlFields,
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
      "aliases:",
      "  - Alpha",
      "  - Beta",
      "status: done",
      "tags:",
      "  - 資料"
    ].join("\n"));
  });

  it("ダブルクォートのスカラーも保持する", () => {
    const yamlText = "title: \"Old # text\" # keep";

    expect(serializeDataPreservingYaml(frontmatterBlock(yamlText), {
      title: "New # text"
    })).toBe("title: \"New # text\" # keep");
  });

  it("トップレベルプロパティを値の書式を変えずに並び替える", () => {
    const yamlText = [
      "title: 'Old' # keep",
      "# このコメント行は位置を保持",
      "aliases:",
      "  - Alpha",
      "chronicle:",
      "  start: 1185",
      "  end: 1333",
      ""
    ].join("\n");

    expect(reorderTopLevelYamlFields(yamlText, ["chronicle", "title", "aliases"])).toBe([
      "chronicle:",
      "  start: 1185",
      "  end: 1333",
      "# このコメント行は位置を保持",
      "title: 'Old' # keep",
      "aliases:",
      "  - Alpha",
      ""
    ].join("\n"));
  });

  it("対象外のトップレベルプロパティと改行形式はその場に保持する", () => {
    const yamlText = "first: 1\r\nuntouched: true\r\nlast:\r\n  nested: value\r\n";

    expect(reorderTopLevelYamlFields(yamlText, ["last", "first"])).toBe(
      "last:\r\n  nested: value\r\nuntouched: true\r\nfirst: 1\r\n"
    );
  });

  it("指定されたキーが現在のYAMLと一致しない場合は変更しない", () => {
    const yamlText = "first: 1\nlast: 2\n";

    expect(reorderTopLevelYamlFields(yamlText, ["last", "missing"])).toBe(yamlText);
  });

  it("固定フィールドと登録済みフィールドを仕様どおり書き戻す", () => {
    expect(serializeData({
      aliases: ["帝都", "王都"],
      chronicle: { start: 1185, end: 1333 },
      custom: ["A", "B"],
      tags: ["資料"]
    }, [{ name: "custom", type: "multi-select" }])).toBe([
      "aliases:",
      "  - 帝都",
      "  - 王都",
      "chronicle:",
      "  start: 1185",
      "  end: 1333",
      "custom:",
      "  - A",
      "  - B",
      "tags:",
      "  - 資料"
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
    expect(parseChronicleYearInput("-300")).toBe(-300);
    expect(parseChronicleYearInput("0")).toBeNull();
    expect(parseChronicleYearInput("1.5")).toBeNull();
    expect(parseChronicleYearInput("year")).toBeNull();
  });

});
