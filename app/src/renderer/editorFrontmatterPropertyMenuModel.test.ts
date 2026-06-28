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
    const state = buildFrontmatterPropertyMenuState(true, ["aliases", "chronicle"], t);

    expect(state.unavailable).toBe(false);
    expect(state.groups.map((group) => group.id)).toEqual(["basic"]);
    expect(state.groups.find((group) => group.id === "basic")?.options.map((option) => option.key)).toEqual(["tags"]);
  });

  it("基本・chronicle系フィールドの表示名を維持する", () => {
    const state = buildFrontmatterPropertyMenuState(true, [], t);
    const labelsByKey = new Map(state.groups.flatMap((group) => group.options.map((option) => [option.key, option.label])));

    expect(labelsByKey.get("aliases")).toBe("別名");
    expect(labelsByKey.get("tags")).toBe("タグ");
    expect(labelsByKey.has("status")).toBe(false);
    expect(labelsByKey.has("plannedDate")).toBe(false);
    expect(labelsByKey.has("actualDate")).toBe(false);
    expect(labelsByKey.get("chronicle")).toBe("chronicle");
  });
});
