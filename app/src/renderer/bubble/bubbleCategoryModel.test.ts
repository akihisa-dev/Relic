import { describe, expect, it } from "vitest";

import {
  applyBubbleCategoryBoundary,
  applyBubbleCategoryMotion,
  constrainBubbleCategoryPoint,
  constrainBubbleNodeToCategoryRegions,
  bubbleCategoryBoundaryRadius,
  bubbleCategoryCenterOffsetForNodeDrag,
  bubbleCategoryContour,
  bubbleCategoryDynamicLayouts,
  bubbleCategoryLayouts,
  bubbleCategoryRegions,
  bubbleCategoryTarget,
  normalizeBubbleCategory
} from "./bubbleCategoryModel";
import {
  translateBubbleCategoryNodes,
  translateBubbleCategoryNodesWithPush
} from "./bubbleCategoryTranslation";

describe("bubbleCategoryModel", () => {
  it("カテゴリを正規化し、空値と非文字列を未分類として扱う", () => {
    expect(normalizeBubbleCategory("  人物  ")).toBe("人物");
    expect(normalizeBubbleCategory("   ")).toBeNull();
    expect(normalizeBubbleCategory(["人物"])).toBeNull();
  });

  it("カテゴリだけへ接触する決定的な配置先を割り当てる", () => {
    const nodes = [
      { category: "資料" },
      { category: "人物" },
      { category: "人物" },
      {},
      { category: null }
    ];
    const layouts = bubbleCategoryLayouts(nodes);
    const layoutsAgain = bubbleCategoryLayouts(nodes);
    const byCategory = bubbleCategoryRegions(layouts);

    expect(layouts.map((layout) => [layout.category, layout.count])).toEqual([
      ["資料", 1],
      ["人物", 2]
    ]);
    expect(layoutsAgain).toEqual(layouts);
    expect(bubbleCategoryTarget(nodes[1]!, byCategory)?.category).toBe("人物");
    expect(bubbleCategoryTarget(nodes[3]!, byCategory)).toBeNull();

    const distance = Math.hypot(
      layouts[0]!.x - layouts[1]!.x,
      layouts[0]!.y - layouts[1]!.y
    );
    expect(distance).toBeLessThan(layouts[0]!.radius + layouts[1]!.radius);
    expect(byCategory.get("資料")?.contacts).toHaveLength(1);
  });

  it("接触方向だけを凹ませ、輪郭同士が隙間なく同じ境界を共有する", () => {
    const regions = bubbleCategoryRegions(bubbleCategoryLayouts([
      { category: "資料" },
      { category: "人物" }
    ]));
    const material = regions.get("資料")!;
    const person = regions.get("人物")!;
    const contact = material.contacts[0]!;
    const materialRadius = bubbleCategoryBoundaryRadius(material, contact.angle);
    const personRadius = bubbleCategoryBoundaryRadius(person, contact.angle + Math.PI);
    const oppositeRadius = bubbleCategoryBoundaryRadius(material, contact.angle + Math.PI);
    const contour = bubbleCategoryContour(material);

    expect(materialRadius).toBeLessThan(material.radius);
    expect(oppositeRadius).toBe(material.radius);
    expect(materialRadius + personRadius).toBeCloseTo(contact.distance, 6);
    expect(contour).toHaveLength(72);
  });

  it("カテゴリ領域の外へ出る座標と速度を必ず内側へ収める", () => {
    const layouts = bubbleCategoryLayouts([{ category: "人物" }]);
    const byCategory = bubbleCategoryRegions(layouts);
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

    applyBubbleCategoryBoundary([outside, inside, uncategorized], byCategory, 0.5);

    expect(outside.vx).toBeLessThan(0);
    expect(outside.vy).toBe(0);
    expect(inside).toMatchObject({ vx: 0, vy: 0 });
    expect(uncategorized).toMatchObject({ vx: 0, vy: 0 });

    const constrained = constrainBubbleCategoryPoint(
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
    const regions = bubbleCategoryRegions(layouts, [{
      backlinkCount: 0,
      category: "人物",
      linkCount: 0,
      x: 120,
      y: 0
    }]);
    const region = regions.get("人物")!;

    expect(bubbleCategoryBoundaryRadius(region, 0)).toBeGreaterThan(region.radius);
    expect(bubbleCategoryBoundaryRadius(region, Math.PI)).toBe(region.radius);
  });

  it("所属ノードをつかんだ場合は自分のバブル内を移動できる", () => {
    const nodes = [
      { category: "人物", x: -10, y: 0 },
      { category: "人物", x: 10, y: 0 }
    ];
    const regions = bubbleCategoryRegions(bubbleCategoryDynamicLayouts(nodes), nodes);
    const moved = constrainBubbleNodeToCategoryRegions(
      nodes[0]!,
      regions,
      { x: 60, y: 20 },
      18
    );

    expect(moved).toEqual({ x: 60, y: 20 });
  });

  it("所属ノードが1件だけでも移動先を先読みしてバブルごと動かせる", () => {
    const nodes = [{
      category: "人物",
      categoryCenterOffsetX: 0,
      categoryCenterOffsetY: 0,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0
    }];
    const initialLayouts = bubbleCategoryDynamicLayouts(nodes);
    const centerOffset = bubbleCategoryCenterOffsetForNodeDrag(
      nodes[0]!,
      initialLayouts,
      { x: 60, y: 20 },
      18
    )!;
    const projectedNodes = [{
      ...nodes[0]!,
      categoryCenterOffsetX: centerOffset.x,
      categoryCenterOffsetY: centerOffset.y,
      x: 60,
      y: 20
    }];
    const regions = bubbleCategoryRegions(
      initialLayouts,
      projectedNodes
    );
    const moved = constrainBubbleNodeToCategoryRegions(
      nodes[0]!,
      regions,
      { x: 60, y: 20 },
      18
    );

    expect(moved).toEqual({ x: 60, y: 20 });
    nodes[0]!.categoryCenterOffsetX = centerOffset.x;
    nodes[0]!.categoryCenterOffsetY = centerOffset.y;
    nodes[0]!.x = moved.x;
    nodes[0]!.y = moved.y;
    expect(bubbleCategoryDynamicLayouts(nodes)[0]).toMatchObject({ x: 0, y: 0 });

    applyBubbleCategoryMotion(nodes, 0.5);
    expect(nodes[0]).toMatchObject({ vx: 0, vy: 0 });

    expect(translateBubbleCategoryNodesWithPush(nodes, "人物", 40, 30))
      .toHaveLength(1);
    expect(nodes[0]).toMatchObject({ fx: 100, fy: 50, x: 100, y: 50 });
    expect(bubbleCategoryDynamicLayouts(nodes)[0]).toMatchObject({ x: 40, y: 30 });
  });

  it("単一ノードが内壁へ達した後の移動量をバブル中心へ渡す", () => {
    const node = {
      category: "人物",
      categoryCenterOffsetX: 0,
      categoryCenterOffsetY: 0,
      vx: 100,
      vy: 0,
      x: 0,
      y: 0
    };
    const regions = bubbleCategoryRegions(bubbleCategoryDynamicLayouts([node]), [node]);

    applyBubbleCategoryBoundary([node], regions, 0.5);

    expect(node.vx).toBe(100);
    expect(node.categoryCenterOffsetX).toBe(-78);
    expect(bubbleCategoryDynamicLayouts([{
      ...node,
      x: node.x + node.vx,
      y: node.y + node.vy
    }])[0]).toMatchObject({ x: 22, y: 0 });
  });

  it("外部ノードが接触した方向の膜をへこませ、バブルへ反力を与える", () => {
    const nodes = [
      { category: "人物", vx: 0, vy: 0, x: -10, y: 0 },
      { category: "人物", vx: 0, vy: 0, x: 10, y: 0 },
      { category: null, vx: 0, vy: 0, x: 110, y: 0 }
    ];

    const regions = applyBubbleCategoryMotion(nodes, 0.5);
    const person = regions.get("人物")!;
    const contactRadius = bubbleCategoryBoundaryRadius(person, 0);

    expect(contactRadius).toBeLessThan(person.radius);
    expect(contactRadius + 18).toBeCloseTo(110, 6);
    expect(bubbleCategoryBoundaryRadius(person, Math.PI)).toBe(person.radius);
    expect((nodes[0]!.vx + nodes[1]!.vx) / 2).toBeLessThan(0);
  });

  it("外部ノードが触れる前は膜を引き込まない", () => {
    const region = bubbleCategoryRegions([{
      category: "人物",
      count: 1,
      radius: 96,
      x: 0,
      y: 0
    }], [{
      category: null,
      x: 115,
      y: 0
    }]).get("人物")!;

    expect(region.obstacles).toHaveLength(0);
    expect(bubbleCategoryBoundaryRadius(region, 0)).toBe(region.radius);
  });

  it("外部ノードを深く押しても局所変形の上限でバブル外へ留める", () => {
    const node = { category: null, x: 20, y: 0 };
    const region = bubbleCategoryRegions([{
      category: "人物",
      count: 1,
      radius: 96,
      x: 0,
      y: 0
    }], [node]);
    const constrained = constrainBubbleNodeToCategoryRegions(
      node,
      region,
      { x: 20, y: 0 },
      18
    );

    expect(constrained.x).toBeGreaterThan(96);
    expect(constrained.y).toBe(0);
  });

  it("未分類と別カテゴリのノードをカテゴリーバブルの外へ押し戻す", () => {
    const regions = bubbleCategoryRegions([{
      category: "人物",
      count: 1,
      radius: 96,
      x: 0,
      y: 0
    }]);
    const uncategorized = { category: null, vx: 0, vy: 0, x: 0, y: 0 };
    const otherCategory = { category: "資料", vx: 0, vy: 0, x: 20, y: 0 };

    applyBubbleCategoryBoundary([uncategorized, otherCategory], regions, 0.5);

    expect(Math.hypot(uncategorized.vx, uncategorized.vy)).toBeGreaterThan(96);
    expect(otherCategory.vx).toBeGreaterThan(76);

    const dragged = constrainBubbleNodeToCategoryRegions(
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

    expect(bubbleCategoryDynamicLayouts(nodes)[0]).toMatchObject({ x: 20, y: 30 });
    const translated = translateBubbleCategoryNodes(nodes, "人物", 15, -5);

    expect(translated).toHaveLength(2);
    expect(bubbleCategoryDynamicLayouts(nodes)[0]).toMatchObject({ x: 35, y: 25 });
    expect(nodes[0]).toMatchObject({ fx: 25, fy: 15, x: 25, y: 15 });
    expect(nodes[2]).toMatchObject({ fx: null, fy: null, x: 100, y: 100 });
  });

  it("近づきすぎたカテゴリ同士へ逆向きの移動速度を与える", () => {
    const nodes = [
      { category: "人物", vx: 0, vy: 0, x: -10, y: 0 },
      { category: "資料", vx: 0, vy: 0, x: 10, y: 0 }
    ];

    applyBubbleCategoryMotion(nodes, 0.5);

    expect(nodes[0]!.vx).toBeLessThan(0);
    expect(nodes[1]!.vx).toBeGreaterThan(0);
  });

  it("ドラッグしたバブルで接触した別のバブルを押して移動する", () => {
    const nodes = [
      { category: "人物", vx: 0, vy: 0, x: -100, y: 0 },
      { category: "資料", vx: 0, vy: 0, x: 100, y: 0 }
    ];
    const translated = translateBubbleCategoryNodesWithPush(nodes, "人物", 200, 0);
    const layouts = bubbleCategoryDynamicLayouts(nodes);
    const byCategory = new Map(layouts.map((layout) => [layout.category, layout]));

    expect(translated).toHaveLength(2);
    expect(byCategory.get("人物")?.x).toBeCloseTo(100, 6);
    expect(byCategory.get("資料")?.x).toBeGreaterThan(250);
  });
});
