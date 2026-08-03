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
