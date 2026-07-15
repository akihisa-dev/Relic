import { describe, expect, it } from "vitest";

import { defaultGraphDrawTheme } from "../graph/graphTypes";
import {
  createSphereData,
  sphereFocusIds,
  sphereLabelLimit,
  sphereLabelNodes,
  sphereLinkTouchesFocus,
  sphereNodeValue,
  type SphereData
} from "./sphereModel";

describe("sphereModel", () => {
  const visibleGraph = {
    links: [{ count: 1, source: "A.md", target: "B.md", type: "link" as const }],
    nodes: [
      { backlinkCount: 0, exists: true, id: "A.md", label: "A", linkCount: 1, path: "A.md", type: "file" as const },
      { backlinkCount: 1, exists: true, id: "B.md", label: "B", linkCount: 0, path: "B.md", type: "file" as const }
    ],
    tagsByNode: new Map<string, string[]>()
  };

  it("共有グラフを変更しない3D専用データを生成する", () => {
    const data = createSphereData(visibleGraph, [], defaultGraphDrawTheme);

    expect(data.nodes).not.toBe(visibleGraph.nodes);
    expect(data.links).not.toBe(visibleGraph.links);
    expect(data.nodes.map((node) => node.id)).toEqual(["A.md", "B.md"]);
    expect(data.links[0]).toMatchObject({ sourceId: "A.md", targetId: "B.md" });

    data.links[0]!.source = data.nodes[0]!;
    expect(visibleGraph.links[0]!.source).toBe("A.md");
  });

  it("注目ノードと接続先を強調対象にする", () => {
    const data = createSphereData(visibleGraph, [], defaultGraphDrawTheme);

    expect(sphereFocusIds(data, "A.md")).toEqual(new Set(["A.md", "B.md"]));
    expect(sphereLinkTouchesFocus(data.links[0]!, "A.md")).toBe(true);
    expect(sphereLinkTouchesFocus(data.links[0]!, null)).toBe(false);
  });

  it("関連数に応じてノード体積を増やし上限を設ける", () => {
    expect(sphereNodeValue({ backlinkCount: 0, linkCount: 0 })).toBeCloseTo(4.2);
    expect(sphereNodeValue({ backlinkCount: 10_000, linkCount: 10_000 })).toBe(18);
  });

  it("通常は全名称を表示し、大規模時は関係数の多い名称を優先する", () => {
    const normalData = createSphereData(visibleGraph, [], defaultGraphDrawTheme);
    expect(sphereLabelNodes(normalData)).toBe(normalData.nodes);

    const largeData: SphereData = {
      links: [],
      nodes: Array.from({ length: sphereLabelLimit + 1 }, (_, index) => ({
        backlinkCount: index,
        baseColor: "#111111",
        exists: true,
        id: `${index}.md`,
        label: String(index),
        linkCount: 0,
        path: `${index}.md`,
        type: "file" as const,
        val: 4
      }))
    };
    const labels = sphereLabelNodes(largeData);
    expect(labels).toHaveLength(sphereLabelLimit);
    expect(labels[0]?.id).toBe(`${sphereLabelLimit}.md`);
    expect(labels.some((node) => node.id === "0.md")).toBe(false);
  });
});
