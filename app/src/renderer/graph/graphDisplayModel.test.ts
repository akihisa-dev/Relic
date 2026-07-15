import { describe, expect, it } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { defaultGraphOptions } from "./graphTypes";
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
    const visible = deriveVisibleGraph(graph, defaultGraphOptions);

    expect(visible.nodes.map((node) => node.id)).toEqual(["A.md", "B.md"]);
    expect(visible.links).toEqual([
      { count: 1, source: "A.md", target: "B.md", type: "link" }
    ]);
    expect(visible.tagsByNode.get("A.md")).toEqual(["project"]);
  });

  it("タグ表示と検索を共通条件として適用する", () => {
    const visible = deriveVisibleGraph(graph, {
      ...defaultGraphOptions,
      search: "tag:project",
      showTags: true
    });

    expect(visible.nodes.map((node) => node.id)).toEqual(["A.md", "#project"]);
    expect(visible.links).toEqual([
      { count: 1, source: "A.md", target: "#project", type: "tag" }
    ]);
  });
});
