import { describe, expect, it } from "vitest";

import {
  applyGraphCategoryBoundary,
  applyGraphCategoryMotion,
  constrainGraphCategoryPoint,
  constrainGraphNodeToCategoryRegions,
  graphCategoryBoundaryRadius,
  graphCategoryContour,
  graphCategoryDynamicLayouts,
  graphCategoryLayouts,
  graphCategoryRegions,
  graphCategoryTarget,
  normalizeGraphCategory,
  translateGraphCategoryNodes,
  translateGraphCategoryNodesWithPush
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

  it("接触方向だけを凹ませ、輪郭同士が隙間なく同じ境界を共有する", () => {
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
    expect(materialRadius + personRadius).toBeCloseTo(contact.distance, 6);
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
      .toBeLessThanOrEqual(layout.radius + 52 - 24);
  });

  it("所属ノードが外側から押す方向だけバブルの輪郭を膨らませる", () => {
    const layouts = [{
      category: "人物",
      count: 1,
      radius: 96,
      x: 0,
      y: 0
    }];
    const regions = graphCategoryRegions(layouts, [{
      backlinkCount: 0,
      category: "人物",
      linkCount: 0,
      x: 120,
      y: 0
    }]);
    const region = regions.get("人物")!;

    expect(graphCategoryBoundaryRadius(region, 0)).toBeGreaterThan(region.radius);
    expect(graphCategoryBoundaryRadius(region, Math.PI)).toBe(region.radius);
  });

  it("未分類と別カテゴリのノードをカテゴリーバブルの外へ押し戻す", () => {
    const regions = graphCategoryRegions([{
      category: "人物",
      count: 1,
      radius: 96,
      x: 0,
      y: 0
    }]);
    const uncategorized = { category: null, vx: 0, vy: 0, x: 0, y: 0 };
    const otherCategory = { category: "資料", vx: 0, vy: 0, x: 20, y: 0 };

    applyGraphCategoryBoundary([uncategorized, otherCategory], regions, 0.5);

    expect(Math.hypot(uncategorized.vx, uncategorized.vy)).toBeGreaterThan(96);
    expect(otherCategory.vx).toBeGreaterThan(76);

    const dragged = constrainGraphNodeToCategoryRegions(
      { category: null },
      regions,
      { x: 0, y: 0 },
      12
    );
    expect(Math.hypot(dragged.x, dragged.y)).toBeGreaterThan(96);
  });

  it("所属ノードの重心へバブルを追従させ、まとまりごと移動する", () => {
    const nodes = [
      { category: "人物", fx: null, fy: null, vx: 0, vy: 0, x: 10, y: 20 },
      { category: "人物", fx: null, fy: null, vx: 0, vy: 0, x: 30, y: 40 },
      { category: null, fx: null, fy: null, vx: 0, vy: 0, x: 100, y: 100 }
    ];

    expect(graphCategoryDynamicLayouts(nodes)[0]).toMatchObject({ x: 20, y: 30 });
    const translated = translateGraphCategoryNodes(nodes, "人物", 15, -5);

    expect(translated).toHaveLength(2);
    expect(graphCategoryDynamicLayouts(nodes)[0]).toMatchObject({ x: 35, y: 25 });
    expect(nodes[0]).toMatchObject({ fx: 25, fy: 15, x: 25, y: 15 });
    expect(nodes[2]).toMatchObject({ fx: null, fy: null, x: 100, y: 100 });
  });

  it("近づきすぎたカテゴリ同士へ逆向きの移動速度を与える", () => {
    const nodes = [
      { category: "人物", vx: 0, vy: 0, x: -10, y: 0 },
      { category: "資料", vx: 0, vy: 0, x: 10, y: 0 }
    ];

    applyGraphCategoryMotion(nodes, 0.5);

    expect(nodes[0]!.vx).toBeLessThan(0);
    expect(nodes[1]!.vx).toBeGreaterThan(0);
  });

  it("ドラッグしたバブルで接触した別のバブルを押して移動する", () => {
    const nodes = [
      { category: "人物", vx: 0, vy: 0, x: -100, y: 0 },
      { category: "資料", vx: 0, vy: 0, x: 100, y: 0 }
    ];
    const translated = translateGraphCategoryNodesWithPush(nodes, "人物", 200, 0);
    const layouts = graphCategoryDynamicLayouts(nodes);
    const byCategory = new Map(layouts.map((layout) => [layout.category, layout]));

    expect(translated).toHaveLength(2);
    expect(byCategory.get("人物")?.x).toBeCloseTo(100, 6);
    expect(byCategory.get("資料")?.x).toBeGreaterThan(250);
  });
});
