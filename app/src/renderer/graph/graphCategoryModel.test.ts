import { describe, expect, it } from "vitest";

import {
  applyGraphCategoryBoundary,
  constrainGraphCategoryPoint,
  graphCategoryBoundaryRadius,
  graphCategoryContour,
  graphCategoryLayouts,
  graphCategoryRegions,
  graphCategoryTarget,
  normalizeGraphCategory
} from "./graphCategoryModel";

describe("graphCategoryModel", () => {
  it("カテゴリを正規化し、空値と非文字列を未分類として扱う", () => {
    expect(normalizeGraphCategory("  人物  ")).toBe("人物");
    expect(normalizeGraphCategory("   ")).toBeNull();
    expect(normalizeGraphCategory(["人物"])).toBeNull();
  });

  it("カテゴリだけへ接触する決定的な配置先を割り当てる", () => {
    const nodes = [
      { category: "資料" },
      { category: "人物" },
      { category: "人物" },
      {},
      { category: null }
    ];
    const layouts = graphCategoryLayouts(nodes);
    const layoutsAgain = graphCategoryLayouts(nodes);
    const byCategory = graphCategoryRegions(layouts);

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
    expect(distance).toBeLessThan(layouts[0]!.radius + layouts[1]!.radius);
    expect(byCategory.get("資料")?.contacts).toHaveLength(1);
  });

  it("接触方向だけを滑らかに凹ませ、輪郭同士を重ねない", () => {
    const regions = graphCategoryRegions(graphCategoryLayouts([
      { category: "資料" },
      { category: "人物" }
    ]));
    const material = regions.get("資料")!;
    const person = regions.get("人物")!;
    const contact = material.contacts[0]!;
    const materialRadius = graphCategoryBoundaryRadius(material, contact.angle);
    const personRadius = graphCategoryBoundaryRadius(person, contact.angle + Math.PI);
    const oppositeRadius = graphCategoryBoundaryRadius(material, contact.angle + Math.PI);
    const contour = graphCategoryContour(material);

    expect(materialRadius).toBeLessThan(material.radius);
    expect(oppositeRadius).toBe(material.radius);
    expect(materialRadius + personRadius).toBeLessThan(contact.distance);
    expect(contour).toHaveLength(72);
  });

  it("カテゴリ領域の外へ出る座標と速度を必ず内側へ収める", () => {
    const layouts = graphCategoryLayouts([{ category: "人物" }]);
    const byCategory = graphCategoryRegions(layouts);
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

    const constrained = constrainGraphCategoryPoint(
      { category: "人物" },
      byCategory,
      { x: layout.x + layout.radius * 3, y: layout.y },
      24
    );
    expect(Math.hypot(constrained.x - layout.x, constrained.y - layout.y))
      .toBeLessThanOrEqual(layout.radius - 24);
  });
});
