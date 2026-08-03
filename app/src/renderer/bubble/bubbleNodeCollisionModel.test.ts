import { describe, expect, it } from "vitest";

import {
  bubbleNodeCollisionRadius,
  constrainBubbleNodePosition,
  constrainBubbleNodeSpacing
} from "./bubbleNodeCollisionModel";

describe("bubbleNodeCollisionModel", () => {
  it("ノードの衝突半径を直接投影して重なりを残さない", () => {
    const options = { nodeSizeMultiplier: 1 };
    const nodes = [
      { backlinkCount: 0, id: "A.md", linkCount: 0, vx: 8, vy: 0, x: 0, y: 0 },
      { backlinkCount: 3, id: "B.md", linkCount: 1, vx: -8, vy: 0, x: 0, y: 0 },
      { backlinkCount: 1, id: "C.md", linkCount: 0, vx: 0, vy: 0, x: 0, y: 0 }
    ];

    constrainBubbleNodeSpacing(nodes, options);

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex]!;
        const right = nodes[rightIndex]!;
        expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeGreaterThanOrEqual(
          bubbleNodeCollisionRadius(left, options) +
          bubbleNodeCollisionRadius(right, options) -
          0.001
        );
      }
    }
    const closingNodes = [
      { backlinkCount: 0, linkCount: 0, vx: 4, vy: 0, x: 0, y: 0 },
      { backlinkCount: 0, linkCount: 0, vx: -4, vy: 0, x: 10, y: 0 }
    ];
    constrainBubbleNodeSpacing(closingNodes, options);
    expect(closingNodes[0]!.vx).toBeLessThanOrEqual(0);
    expect(closingNodes[1]!.vx).toBeGreaterThanOrEqual(0);

    const anchored = {
      backlinkCount: 0,
      fx: 0,
      fy: 0,
      id: "dragged.md",
      linkCount: 0,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0
    };
    const pushed = {
      backlinkCount: 0,
      id: "target.md",
      linkCount: 0,
      vx: 0,
      vy: 0,
      x: 10,
      y: 0
    };
    constrainBubbleNodeSpacing([anchored, pushed], options, new Set([anchored.id]));
    expect(anchored).toMatchObject({ x: 0, y: 0 });
    expect(pushed.x).toBeGreaterThan(10);
    expect(Math.hypot(anchored.x - pushed.x, anchored.y - pushed.y))
      .toBeGreaterThanOrEqual(
        bubbleNodeCollisionRadius(anchored, options) +
        bubbleNodeCollisionRadius(pushed, options) -
        0.001
      );

    const touching = [
      { backlinkCount: 0, id: "left.md", linkCount: 0, x: 0, y: 0 },
      { backlinkCount: 0, id: "right.md", linkCount: 0, x: 10, y: 0 }
    ];
    constrainBubbleNodeSpacing(touching, options);
    expect(Math.hypot(touching[0]!.x - touching[1]!.x, touching[0]!.y - touching[1]!.y))
      .toBeCloseTo(
        bubbleNodeCollisionRadius(touching[0]!, options) +
        bubbleNodeCollisionRadius(touching[1]!, options),
        6
      );

    const dragged = { ...nodes[0]!, x: 0, y: 0 };
    const constrained = constrainBubbleNodePosition(
      dragged,
      [nodes[1]!],
      { x: nodes[1]!.x, y: nodes[1]!.y },
      options
    );
    expect(Math.hypot(constrained.x - nodes[1]!.x, constrained.y - nodes[1]!.y))
      .toBeGreaterThanOrEqual(
        bubbleNodeCollisionRadius(dragged, options) +
        bubbleNodeCollisionRadius(nodes[1]!, options) -
        0.001
      );
  });
});
