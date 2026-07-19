import { describe, expect, it } from "vitest";

import { defaultGraphDrawTheme } from "../graph/graphTypes";
import {
  createSphereData,
  SPHERE_MIN_GUIDE_RADIUS,
  sphereCameraFitDistance,
  sphereCoreRadius,
  sphereFocusIds,
  sphereLayoutSettings,
  sphereLinkDistance,
  sphereLinkTouchesFocus,
  sphereNodeChargeStrength,
  sphereNodeColors,
  sphereNodeValue
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
    const data = createSphereData(visibleGraph);

    expect(data.nodes).not.toBe(visibleGraph.nodes);
    expect(data.links).not.toBe(visibleGraph.links);
    expect(data.nodes.map((node) => node.id)).toEqual(["A.md", "B.md"]);
    expect(data.links[0]).toMatchObject({ sourceId: "A.md", targetId: "B.md" });

    data.links[0]!.source = data.nodes[0]!;
    expect(visibleGraph.links[0]!.source).toBe("A.md");
  });

  it("注目ノードと接続先を強調対象にする", () => {
    const data = createSphereData(visibleGraph);

    expect(sphereFocusIds(data, "A.md")).toEqual(new Set(["A.md", "B.md"]));
    expect(sphereLinkTouchesFocus(data.links[0]!, "A.md")).toBe(true);
    expect(sphereLinkTouchesFocus(data.links[0]!, null)).toBe(false);
  });

  it("テーマ色をトポロジーと別に生成する", () => {
    const data = createSphereData(visibleGraph);
    const colors = sphereNodeColors(visibleGraph, [], defaultGraphDrawTheme);

    expect(colors.get("A.md")).toBeTruthy();
    expect(data.nodes[0]).not.toHaveProperty("baseColor");
  });

  it("関連数に応じてノード体積を増やし上限を設ける", () => {
    expect(sphereNodeValue({ backlinkCount: 0, linkCount: 0 })).toBeCloseTo(4.2);
    expect(sphereNodeValue({ backlinkCount: 10_000, linkCount: 10_000 })).toBe(18);
  });

  it("リンク密度が高いほど反発力とリンク距離を増やす", () => {
    const sparse = sphereLayoutSettings(100, 40);
    const dense = sphereLayoutSettings(100, 500);

    expect(dense.chargeStrength).toBeLessThan(sparse.chargeStrength);
    expect(dense.linkDistance).toBeGreaterThan(sparse.linkDistance);
    expect(dense.linkOpacity).toBe(0.18);
    expect(sparse.linkOpacity).toBe(0.48);
    expect(dense.nodeRelSize).toBeLessThan(sparse.nodeRelSize);
    expect(dense.nodeRelSize).toBeGreaterThanOrEqual(2.7);
    expect(dense.boundaryRadius).toBe(sparse.boundaryRadius);
  });

  it("接続数の多いノードを追加で押し広げる", () => {
    const settings = sphereLayoutSettings(900, 3_600);
    const ordinary = { backlinkCount: 1, linkCount: 2 };
    const hub = { backlinkCount: 40, linkCount: 60 };

    expect(sphereNodeChargeStrength(hub, settings))
      .toBeLessThan(sphereNodeChargeStrength(ordinary, settings));
    expect(sphereLinkDistance(hub, ordinary, settings))
      .toBeGreaterThan(sphereLinkDistance(ordinary, ordinary, settings));
  });

  it("少数の外れ値ではなく大部分のノードからガイド半径を求める", () => {
    const nodes = Array.from({ length: 10 }, (_, index) => ({ x: (index + 1) * 10, y: 0, z: 0 }));
    nodes.push({ x: 1_000, y: 0, z: 0 });

    expect(sphereCoreRadius(nodes)).toBe(100);
    expect(sphereCoreRadius([])).toBe(SPHERE_MIN_GUIDE_RADIUS);
  });

  it("正面から全ノードを収めるカメラ距離を表示領域から求める", () => {
    const distance = sphereCameraFitDistance(
      { x: [-120, 100], y: [-80, 90], z: [-60, 70] },
      { aspect: 1.5, fov: 60, height: 600 },
      72
    );

    expect(distance).toBeGreaterThan(240);
    expect(sphereCameraFitDistance(
      { x: [0, 0], y: [0, 0], z: [0, 0] },
      { aspect: 1.5, fov: 60, height: 600 },
      72
    )).toBeNull();
  });
});
