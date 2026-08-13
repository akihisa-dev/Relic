import { describe, expect, it } from "vitest";

import { bubbleNodeBaseRadiusFromWeight } from "./bubbleLayout";
import { fitBubbleViewToNodes, bubbleContentBounds } from "./bubbleViewportModel";
import type { BubbleOptions, BubbleSimNode, BubbleViewTransform } from "./bubbleTypes";

const options: BubbleOptions = {
  centerStrength: 0.04,
  linkDistance: 250,
  linkStrength: 0.32,
  nodeSizeMultiplier: 1,
  repelStrength: 12,
  textFadeMultiplier: 0
};

function node(id: string, x: number, y: number, category?: string): BubbleSimNode {
  return {
    backlinkCount: 0,
    ...(category ? { category } : {}),
    exists: true,
    fx: null,
    fy: null,
    id,
    label: id,
    linkCount: 0,
    path: id,
    type: "file",
    vx: 0,
    vy: 0,
    x,
    y
  };
}

function view(): BubbleViewTransform {
  return {
    panX: 0,
    panY: 0,
    scale: 1,
    targetScale: 1,
    zoomCenterX: 0,
    zoomCenterY: 0
  };
}

describe("bubbleViewportModel", () => {
  it("表示対象の外接範囲を余白付きでキャンバスへ収める", () => {
    const nodes = [
      node("uncategorized.md", 0, 0),
      node("person-a.md", 324, -108, "人物"),
      node("person-b.md", 324, 108, "人物")
    ];
    const current = view();

    fitBubbleViewToNodes(current, nodes, options, 900, 600);

    const bounds = bubbleContentBounds(nodes, options)!;
    const padding = 48;
    const screenLeft = 900 / 2 + current.panX + bounds.minX * current.scale;
    const screenRight = 900 / 2 + current.panX + bounds.maxX * current.scale;
    const screenTop = 600 / 2 + current.panY + bounds.minY * current.scale;
    const screenBottom = 600 / 2 + current.panY + bounds.maxY * current.scale;

    expect(screenLeft).toBeGreaterThanOrEqual(padding - 0.001);
    expect(screenRight).toBeLessThanOrEqual(900 - padding + 0.001);
    expect(screenTop).toBeGreaterThanOrEqual(padding - 0.001);
    expect(screenBottom).toBeLessThanOrEqual(600 - padding + 0.001);
    expect(current.panX).toBeLessThan(0);
    expect(current.targetScale).toBe(current.scale);
  });

  it("空グラフと極端な座標でも有限な初期視点へ戻す", () => {
    const current = view();
    current.panX = 400;
    current.panY = -200;
    current.scale = 4;
    current.targetScale = 4;

    fitBubbleViewToNodes(current, [], options, 900, 600);
    expect(current).toEqual({
      panX: 0,
      panY: 0,
      scale: 1,
      targetScale: 1,
      zoomCenterX: 0,
      zoomCenterY: 0
    });

    fitBubbleViewToNodes(
      current,
      [node("far.md", Number.MAX_VALUE, -Number.MAX_VALUE)],
      options,
      900,
      600
    );
    expect(Number.isFinite(current.panX)).toBe(true);
    expect(Number.isFinite(current.panY)).toBe(true);
    expect(Number.isFinite(current.scale)).toBe(true);
    expect(current.scale).toBeLessThanOrEqual(1);
    expect(bubbleNodeBaseRadiusFromWeight(0, options)).toBeGreaterThan(0);
  });
});
