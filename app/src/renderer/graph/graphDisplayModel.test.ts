import { describe, expect, it } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { deriveVisibleGraph } from "./graphDisplayModel";

const graph: WorkspaceGraph = {
  links: [
    { count: 1, source: "A.md", target: "B.md", type: "link" },
    { count: 1, source: "A.md", target: "#project", type: "tag" }
  ],
  nodes: [
    { backlinkCount: 0, exists: true, id: "A.md", label: "A", linkCount: 2, path: "A.md", type: "file" },
    { backlinkCount: 1, exists: true, id: "B.md", label: "B", linkCount: 0, path: "B.md", type: "file" },
    { backlinkCount: 1, exists: true, id: "#project", label: "#project", linkCount: 0, path: null, type: "tag" }
  ]
};

describe("deriveVisibleGraph", () => {
  it("2Dと3Dで共有する表示条件から同じノードとリンクを導出する", () => {
    const visible = deriveVisibleGraph(graph);

    expect(visible.nodes.map((node) => node.id)).toEqual(["A.md", "B.md"]);
    expect(visible.links).toEqual([
      { count: 1, source: "A.md", target: "B.md", type: "link" }
    ]);
  });

  it("固定表示条件ではタグと添付を除き、未解決と孤立ファイルを残す", () => {
    const visible = deriveVisibleGraph({
      links: [],
      nodes: [
        ...graph.nodes,
        { backlinkCount: 0, exists: false, id: "Missing.md", label: "Missing", linkCount: 0, path: null, type: "unresolved" },
        { backlinkCount: 0, exists: true, id: "image.png", label: "image", linkCount: 0, path: null, type: "attachment" }
      ]
    });

    expect(visible.nodes.map((node) => node.id)).toEqual(["A.md", "B.md", "Missing.md"]);
    expect(visible.links).toEqual([]);
  });
});
