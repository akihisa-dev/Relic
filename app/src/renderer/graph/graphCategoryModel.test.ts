import { describe, expect, it } from "vitest";

import {
  applyGraphCategoryBoundary,
  graphCategoryLayouts,
  graphCategoryTarget,
  normalizeGraphCategory
} from "./graphCategoryModel";

describe("graphCategoryModel", () => {
  it("カテゴリを正規化し、空値と非文字列を未分類として扱う", () => {
    expect(normalizeGraphCategory("  人物  ")).toBe("人物");
    expect(normalizeGraphCategory("   ")).toBeNull();
    expect(normalizeGraphCategory(["人物"])).toBeNull();
  });

  it("カテゴリだけへ重ならない決定的な配置先を割り当てる", () => {
    const nodes = [
      { category: "資料" },
      { category: "人物" },
      { category: "人物" },
      {},
      { category: null }
    ];
    const layouts = graphCategoryLayouts(nodes);
    const layoutsAgain = graphCategoryLayouts(nodes);
    const byCategory = new Map(layouts.map((layout) => [layout.category, layout]));

    expect(layouts.map((layout) => [layout.category, layout.count])).toEqual([
      ["資料", 1],
      ["人物", 2]
    ]);
    expect(layoutsAgain).toEqual(layouts);
    expect(graphCategoryTarget(nodes[1]!, byCategory)?.category).toBe("人物");
    expect(graphCategoryTarget(nodes[3]!, byCategory)).toBeNull();

    const distance = Math.hypot(
      layouts[0]!.x - layouts[1]!.x,
      layouts[0]!.y - layouts[1]!.y
    );
    expect(distance).toBeGreaterThan(layouts[0]!.radius + layouts[1]!.radius);
  });

  it("カテゴリ領域の外へ出たノードだけを内側へ戻す", () => {
    const layouts = graphCategoryLayouts([{ category: "人物" }]);
    const byCategory = new Map(layouts.map((layout) => [layout.category, layout]));
    const layout = layouts[0]!;
    const outside = {
      category: "人物",
      vx: 0,
      vy: 0,
      x: layout.x + layout.radius + 40,
      y: layout.y
    };
    const inside = {
      category: "人物",
      vx: 0,
      vy: 0,
      x: layout.x,
      y: layout.y
    };
    const uncategorized = { vx: 0, vy: 0, x: 500, y: 500 };

    applyGraphCategoryBoundary([outside, inside, uncategorized], byCategory, 0.5);

    expect(outside.vx).toBeLessThan(0);
    expect(outside.vy).toBe(0);
    expect(inside).toMatchObject({ vx: 0, vy: 0 });
    expect(uncategorized).toMatchObject({ vx: 0, vy: 0 });
  });
});
