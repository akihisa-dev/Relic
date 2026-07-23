import { describe, expect, it } from "vitest";

import type { WorkspaceGraph, WorkspaceGraphNode } from "../../shared/ipc";
import {
  applyBubbleSimulationPositions,
  bubbleSimulationLinks,
  bubbleSimulationNodes,
  syncBubbleLayout
} from "./bubbleLayout";
import {
  bubbleCategoryBoundaryRadius,
  bubbleCategoryLayouts,
  bubbleCategoryRegions
} from "./bubbleCategoryModel";
import type { BubbleSimNode } from "./bubbleTypes";

function graphNode(patch: Partial<WorkspaceGraphNode> & Pick<WorkspaceGraphNode, "id">): WorkspaceGraphNode {
  return {
    backlinkCount: 0,
    exists: true,
    label: patch.id,
    linkCount: 0,
    path: patch.id,
    type: "file",
    ...patch
  };
}

describe("bubbleLayout", () => {
  it("グラフの差分を既存ノードへ同期し、有効なリンクだけを返す", () => {
    const nodes = new Map<string, BubbleSimNode>();
    const graph: WorkspaceGraph = {
      links: [
        { count: 2, source: "A.md", target: "B.md", type: "link" },
        { count: 1, source: "A.md", target: "Missing.md", type: "link" }
      ],
      nodes: [
        graphNode({ category: "人物", id: "A.md", label: "A", linkCount: 1 }),
        graphNode({ backlinkCount: 1, id: "B.md", label: "B" })
      ]
    };

    const links = syncBubbleLayout(graph, nodes);

    expect([...nodes.keys()]).toEqual(["A.md", "B.md"]);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ count: 2, source: "A.md", target: "B.md" });
    expect(links[0]?.sourceNode).toBe(nodes.get("A.md"));
    expect(links[0]?.targetNode).toBe(nodes.get("B.md"));

    const categoryNode = nodes.get("A.md")!;
    const region = bubbleCategoryRegions(bubbleCategoryLayouts(nodes.values())).get("人物")!;
    const angle = Math.atan2(categoryNode.y - region.y, categoryNode.x - region.x);
    expect(Math.hypot(categoryNode.x - region.x, categoryNode.y - region.y))
      .toBeLessThan(bubbleCategoryBoundaryRadius(region, angle));
  });

  it("Workerへ渡すスナップショットと戻り座標を同じ順序で扱う", () => {
    const nodes = new Map<string, BubbleSimNode>();
    const graph: WorkspaceGraph = {
      links: [{ count: 1, source: "A.md", target: "B.md", type: "link" }],
      nodes: [
        graphNode({ category: "人物", id: "A.md", label: "A", linkCount: 1 }),
        graphNode({ backlinkCount: 1, id: "B.md", label: "B" })
      ]
    };
    const links = syncBubbleLayout(graph, nodes);
    const snapshots = bubbleSimulationNodes(nodes.values());
    const linkSnapshots = bubbleSimulationLinks(links);
    const buffer = new ArrayBuffer(snapshots.length * 6 * Float32Array.BYTES_PER_ELEMENT);
    const values = new Float32Array(buffer);
    values.set([
      12, 34, 1.5, -0.5, -24, 8,
      -20, 8, 0, 2, 0, 0
    ]);

    applyBubbleSimulationPositions(nodes, {
      buffer,
      ids: snapshots.map((node) => node.id),
      type: "positions"
    });

    expect(linkSnapshots).toEqual([{ count: 1, source: "A.md", target: "B.md" }]);
    expect(snapshots.map((node) => ({ category: node.category, id: node.id }))).toEqual([
      { category: "人物", id: "A.md" },
      { category: null, id: "B.md" }
    ]);
    expect(snapshots[0]).toMatchObject({
      categoryCenterOffsetX: 0,
      categoryCenterOffsetY: 0
    });
    expect(nodes.get("A.md")).toMatchObject({
      categoryCenterOffsetX: -24,
      categoryCenterOffsetY: 8,
      vx: 1.5,
      vy: -0.5,
      x: 12,
      y: 34
    });
    expect(nodes.get("B.md")).toMatchObject({ vx: 0, vy: 2, x: -20, y: 8 });
  });

  it("単一ノードのバブル中心差分を維持し、同カテゴリが増えた場合は解除する", () => {
    const nodes = new Map<string, BubbleSimNode>();
    const firstGraph: WorkspaceGraph = {
      links: [],
      nodes: [graphNode({ category: "人物", id: "A.md" })]
    };
    syncBubbleLayout(firstGraph, nodes);
    const first = nodes.get("A.md")!;
    first.categoryCenterOffsetX = -40;
    first.categoryCenterOffsetY = 12;

    syncBubbleLayout(firstGraph, nodes);
    expect(bubbleSimulationNodes(nodes.values())[0]).toMatchObject({
      categoryCenterOffsetX: -40,
      categoryCenterOffsetY: 12
    });

    syncBubbleLayout({
      links: [],
      nodes: [
        graphNode({ category: "人物", id: "A.md" }),
        graphNode({ category: "人物", id: "B.md" })
      ]
    }, nodes);
    expect(nodes.get("A.md")).toMatchObject({
      categoryCenterOffsetX: 0,
      categoryCenterOffsetY: 0
    });
  });
});
