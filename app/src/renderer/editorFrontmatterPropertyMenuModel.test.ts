import { describe, expect, it } from "vitest";

import { createTranslator } from "./i18nModel";
import { buildFrontmatterPropertyMenuState } from "./editorFrontmatterPropertyMenuModel";

const t = createTranslator("ja");

describe("editorFrontmatterPropertyMenuModel", () => {
  it("追加できない状態では候補を出さずunavailableにする", () => {
    expect(buildFrontmatterPropertyMenuState(false, [], t)).toEqual({
      groups: [],
      unavailable: true
    });
  });

  it("使用済みの固定プロパティを候補から外して分類する", () => {
    const state = buildFrontmatterPropertyMenuState(true, ["plannedDate", "aliases", "chronicle0"], t);

    expect(state.unavailable).toBe(false);
    expect(state.groups.map((group) => group.id)).toEqual(["date", "basic", "chronicle"]);
    expect(state.groups.find((group) => group.id === "date")?.options.map((option) => option.key)).toEqual(["actualDate"]);
    expect(state.groups.find((group) => group.id === "basic")?.options.map((option) => option.key)).toEqual(["tags", "status"]);
    expect(state.groups.find((group) => group.id === "chronicle")?.options.map((option) => option.key)).not.toContain("chronicle0");
  });

  it("日付・基本・chronicle系フィールドの表示名を維持する", () => {
    const state = buildFrontmatterPropertyMenuState(true, [], t);
    const labelsByKey = new Map(state.groups.flatMap((group) => group.options.map((option) => [option.key, option.label])));

    expect(labelsByKey.get("aliases")).toBe("別名");
    expect(labelsByKey.get("tags")).toBe("タグ");
    expect(labelsByKey.get("status")).toBe("状態");
    expect(labelsByKey.get("plannedDate")).toBe("予定日");
    expect(labelsByKey.get("actualDate")).toBe("実績日");
    expect(labelsByKey.get("chronicle0")).toBe("chronicle0");
  });
});
