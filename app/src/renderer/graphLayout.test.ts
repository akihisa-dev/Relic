import { describe, expect, it } from "vitest";

import type { WorkspaceGraph, WorkspaceGraphNode } from "../shared/ipc";
import {
  buildFilteredGraph,
  buildGraphViewBox,
  buildGroupByPath,
  collectLocalGraphPaths,
  collectRelatedGraphPaths,
  GRAPH_HEIGHT,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_PADDING,
  GRAPH_WIDTH,
  layoutGraph,
  matchesGraphGroup,
  tickGraphSimulation
} from "./graphLayout";

const graph: WorkspaceGraph = {
  edges: [
    { sourcePath: "Alpha.md", targetPath: "Beta.md" },
    { sourcePath: "Beta.md", targetPath: "folder/Gamma.md" },
    { sourcePath: "folder/Gamma.md", targetPath: "Alpha.md" },
    { sourcePath: "Beta.md", targetPath: "extra/Delta.md" }
  ],
  nodes: [
    { folder: "", name: "Alpha", path: "Alpha.md", tags: ["alpha"] },
    { folder: "", name: "Beta", path: "Beta.md", tags: [] },
    { folder: "folder", name: "Gamma", path: "folder/Gamma.md", tags: ["beta"] },
    { folder: "archive", name: "Archive", path: "archive/Archive.md", tags: ["old"] },
    { folder: "extra", name: "Delta", path: "extra/Delta.md", tags: [] }
  ]
};

const defaultFilterInput = {
  activeFilePath: null,
  folderFilter: "",
  graph,
  linkFilter: "all" as const,
  localGraphDepth: 0,
  minDegree: 0,
  query: "",
  showOrphans: true,
  tagFilter: ""
};

const forceSettings = {
  centerForce: 1,
  linkDistance: 118,
  linkForce: 1,
  repelForce: 1
};

function distanceFromCenter(point: { x: number; y: number }): number {
  return Math.hypot(point.x - GRAPH_WIDTH / 2, point.y - GRAPH_HEIGHT / 2);
}

function pointBounds(points: { x: number; y: number }[]): { height: number; width: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    height: Math.max(...ys) - Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs)
  };
}

describe("buildGraphViewBox", () => {
  it("zoomとpanを既存通りviewBoxへ反映する", () => {
    expect(buildGraphViewBox(1, { x: 0, y: 0 })).toEqual({
      height: GRAPH_HEIGHT,
      width: GRAPH_WIDTH,
      x: 0,
      y: 0
    });

    const panned = buildGraphViewBox(1.8, { x: 48, y: -32 });
    expect(panned.width).toBeCloseTo(GRAPH_WIDTH / 1.8);
    expect(panned.height).toBeCloseTo(GRAPH_HEIGHT / 1.8);
    expect(panned.x).toBeCloseTo((GRAPH_WIDTH - GRAPH_WIDTH / 1.8) / 2 + 48);
    expect(panned.y).toBeCloseTo((GRAPH_HEIGHT - GRAPH_HEIGHT / 1.8) / 2 - 32);
  });

  it("zoomをグラフ表示範囲内に丸める", () => {
    expect(GRAPH_MAX_ZOOM).toBe(40);
    expect(buildGraphViewBox(999, { x: 0, y: 0 }).width).toBeCloseTo(GRAPH_WIDTH / GRAPH_MAX_ZOOM);
    expect(buildGraphViewBox(0, { x: 0, y: 0 }).width).toBeCloseTo(GRAPH_WIDTH / GRAPH_MIN_ZOOM);
  });

  it("points指定時はグラフ塊にfitしたviewBoxを作る", () => {
    const points = [
      { ...graph.nodes[0], degree: 0, incoming: 0, outgoing: 0, x: 720, y: 420 },
      { ...graph.nodes[1], degree: 0, incoming: 0, outgoing: 0, x: 880, y: 480 }
    ];
    const fit = buildGraphViewBox(1, { x: 0, y: 0 }, points);

    expect(fit.width).toBeLessThan(GRAPH_WIDTH);
    expect(fit.height).toBeLessThan(GRAPH_HEIGHT);
    expect(fit.x).toBeLessThan(720);
    expect(fit.x + fit.width).toBeGreaterThan(880);
    expect(fit.y).toBeLessThan(420);
    expect(fit.y + fit.height).toBeGreaterThan(480);
  });
});

describe("buildFilteredGraph", () => {
  it("folder、tag、query、link、degree、orphan条件で既存通り絞り込む", () => {
    expect(buildFilteredGraph(defaultFilterInput).nodes.map((node) => node.path)).toEqual([
      "Alpha.md",
      "Beta.md",
      "folder/Gamma.md",
      "archive/Archive.md",
      "extra/Delta.md"
    ]);

    expect(buildFilteredGraph({ ...defaultFilterInput, folderFilter: "folder" }).nodes.map((node) => node.path)).toEqual([
      "folder/Gamma.md"
    ]);
    expect(buildFilteredGraph({ ...defaultFilterInput, tagFilter: "beta" }).nodes.map((node) => node.path)).toEqual([
      "folder/Gamma.md"
    ]);
    expect(buildFilteredGraph({ ...defaultFilterInput, query: "extra" }).nodes.map((node) => node.path)).toEqual([
      "extra/Delta.md"
    ]);
    expect(buildFilteredGraph({ ...defaultFilterInput, linkFilter: "unlinked" }).nodes.map((node) => node.path)).toEqual([
      "archive/Archive.md"
    ]);
    expect(buildFilteredGraph({ ...defaultFilterInput, showOrphans: false }).nodes.map((node) => node.path)).toEqual([
      "Alpha.md",
      "Beta.md",
      "folder/Gamma.md",
      "extra/Delta.md"
    ]);
    expect(buildFilteredGraph({ ...defaultFilterInput, minDegree: 3 }).nodes.map((node) => node.path)).toEqual([
      "Beta.md"
    ]);
  });

  it("local graph depthで中心ノード周辺だけを残す", () => {
    const filtered = buildFilteredGraph({
      ...defaultFilterInput,
      activeFilePath: "Alpha.md",
      localGraphDepth: 1
    });

    expect(filtered.nodes.map((node) => node.path)).toEqual([
      "Alpha.md",
      "Beta.md",
      "folder/Gamma.md"
    ]);
    expect(filtered.edges).toEqual([
      { sourcePath: "Alpha.md", targetPath: "Beta.md" },
      { sourcePath: "Beta.md", targetPath: "folder/Gamma.md" },
      { sourcePath: "folder/Gamma.md", targetPath: "Alpha.md" }
    ]);
  });
});

describe("graph query helpers", () => {
  it("group queryを通常検索、tag検索、folder検索として判定する", () => {
    const node = graph.nodes[2];

    expect(matchesGraphGroup(node, "gamma")).toBe(true);
    expect(matchesGraphGroup(node, "#bet")).toBe(true);
    expect(matchesGraphGroup(node, "folder:fold")).toBe(true);
    expect(matchesGraphGroup(node, "missing")).toBe(false);
  });

  it("active groupを最初に一致した条件でnodeへ割り当てる", () => {
    const groups = [
      { color: "#0ea5e9", id: "tag", query: "#beta" },
      { color: "#f59e0b", id: "folder", query: "folder:archive" },
      { color: "#8b5cf6", id: "name", query: "alpha" }
    ];
    const groupByPath = buildGroupByPath(graph.nodes, groups);

    expect(groupByPath.get("folder/Gamma.md")?.id).toBe("tag");
    expect(groupByPath.get("archive/Archive.md")?.id).toBe("folder");
    expect(groupByPath.get("Alpha.md")?.id).toBe("name");
    expect(groupByPath.has("Beta.md")).toBe(false);
  });

  it("focused pathの関連ノードとlocal depth pathを抽出する", () => {
    expect([...collectRelatedGraphPaths(graph.edges, "Alpha.md")]).toEqual([
      "Alpha.md",
      "Beta.md",
      "folder/Gamma.md"
    ]);
    expect([...collectLocalGraphPaths(graph.edges, "Alpha.md", 1)]).toEqual([
      "Alpha.md",
      "Beta.md",
      "folder/Gamma.md"
    ]);
  });
});

describe("graph layout simulation", () => {
  it("4種類の配置モードでnodeをbounds内に置く", () => {
    for (const layoutMode of ["standard", "radial", "cluster", "scatter"] as const) {
      const points = layoutGraph(graph.nodes, graph.edges, forceSettings, layoutMode);

      expect(points).toHaveLength(graph.nodes.length);
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
        expect(point.x).toBeLessThanOrEqual(GRAPH_WIDTH - GRAPH_PADDING);
        expect(point.y).toBeGreaterThanOrEqual(GRAPH_PADDING);
        expect(point.y).toBeLessThanOrEqual(GRAPH_HEIGHT - GRAPH_PADDING);
      }
    }
  });

  it("scatter配置は同じpathから安定した座標を作る", () => {
    const first = layoutGraph(graph.nodes, graph.edges, forceSettings, "scatter");
    const second = layoutGraph(graph.nodes, graph.edges, forceSettings, "scatter");

    expect(second.map((point) => ({ path: point.path, x: point.x, y: point.y }))).toEqual(
      first.map((point) => ({ path: point.path, x: point.x, y: point.y }))
    );
  });

  it("radial配置はリンク数が多いnodeを内側寄りに置く", () => {
    const points = layoutGraph(graph.nodes, graph.edges, forceSettings, "radial");
    const hub = points.find((point) => point.path === "Beta.md");
    const orphan = points.find((point) => point.path === "archive/Archive.md");

    expect(hub).toBeDefined();
    expect(orphan).toBeDefined();
    expect(distanceFromCenter(hub!)).toBeLessThan(distanceFromCenter(orphan!));
  });

  it("cluster配置はリンクのまとまりごとに初期位置を分ける", () => {
    const clusteredGraph: WorkspaceGraph = {
      edges: [
        { sourcePath: "A.md", targetPath: "B.md" },
        { sourcePath: "C.md", targetPath: "D.md" }
      ],
      nodes: [
        { folder: "", name: "A", path: "A.md", tags: [] },
        { folder: "", name: "B", path: "B.md", tags: [] },
        { folder: "", name: "C", path: "C.md", tags: [] },
        { folder: "", name: "D", path: "D.md", tags: [] }
      ]
    };
    const points = layoutGraph(clusteredGraph.nodes, clusteredGraph.edges, forceSettings, "cluster");
    const firstCluster = points.filter((point) => point.path === "A.md" || point.path === "B.md");
    const secondCluster = points.filter((point) => point.path === "C.md" || point.path === "D.md");
    const firstCenterY = firstCluster.reduce((sum, point) => sum + point.y, 0) / firstCluster.length;
    const secondCenterY = secondCluster.reduce((sum, point) => sum + point.y, 0) / secondCluster.length;

    expect(Math.abs(firstCenterY - secondCenterY)).toBeGreaterThan(80);
  });

  it("初期レイアウトとsimulation tickでnodeをbounds内に保ち、pinしたnodeは動かさない", () => {
    const points = layoutGraph(graph.nodes, graph.edges, forceSettings);

    expect(points.map((point) => point.path)).toEqual([
      "Alpha.md",
      "archive/Archive.md",
      "Beta.md",
      "extra/Delta.md",
      "folder/Gamma.md"
    ]);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(point.x).toBeLessThanOrEqual(GRAPH_WIDTH - GRAPH_PADDING);
      expect(point.y).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(point.y).toBeLessThanOrEqual(GRAPH_HEIGHT - GRAPH_PADDING);
    }

    const simPoints = points.map((point) => ({ ...point, vx: 0, vy: 0 }));
    const pinnedBefore = simPoints.find((point) => point.path === "Beta.md");
    expect(pinnedBefore).toBeDefined();

    const next = tickGraphSimulation(simPoints, graph.edges, forceSettings, "Beta.md");
    const pinnedAfter = next.find((point) => point.path === "Beta.md");

    expect(pinnedAfter?.x).toBe(pinnedBefore?.x);
    expect(pinnedAfter?.y).toBe(pinnedBefore?.y);
    expect(pinnedAfter?.vx).toBe(0);
    expect(pinnedAfter?.vy).toBe(0);
    for (const point of next) {
      expect(point.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(point.x).toBeLessThanOrEqual(GRAPH_WIDTH - GRAPH_PADDING);
      expect(point.y).toBeGreaterThanOrEqual(GRAPH_PADDING);
      expect(point.y).toBeLessThanOrEqual(GRAPH_HEIGHT - GRAPH_PADDING);
    }
  });

  it("単独nodeはグラフ中央へ置く", () => {
    const singleNode: WorkspaceGraphNode = { folder: "", name: "Solo", path: "Solo.md", tags: [] };
    expect(layoutGraph([singleNode], [], forceSettings)).toEqual([
      {
        ...singleNode,
        degree: 0,
        incoming: 0,
        outgoing: 0,
        x: GRAPH_WIDTH / 2,
        y: GRAPH_HEIGHT / 2
      }
    ]);
  });

  it("1000 node / 1980 link規模でも矩形外枠に張り付かない自然なクラウドを生成する", () => {
    const largeNodes = Array.from({ length: 1000 }, (_, index): WorkspaceGraphNode => ({
      folder: index % 5 === 0 ? "group" : "",
      name: `N${index}`,
      path: `N${index}.md`,
      tags: []
    }));
    const largeEdges = Array.from({ length: 1980 }, (_, index) => ({
      sourcePath: `N${index % largeNodes.length}.md`,
      targetPath: `N${(index * 7 + 13) % largeNodes.length}.md`
    }));

    const points = layoutGraph(largeNodes, largeEdges, forceSettings, "standard");
    const next = tickGraphSimulation(points.map((point) => ({ ...point, vx: 0, vy: 0 })), largeEdges, forceSettings, null);

    expect(next).toHaveLength(1000);
    for (const point of next) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    const pinnedToFrameCount = next.filter((point) => (
      Math.abs(point.x - GRAPH_PADDING) <= 1 ||
      Math.abs(point.x - (GRAPH_WIDTH - GRAPH_PADDING)) <= 1 ||
      Math.abs(point.y - GRAPH_PADDING) <= 1 ||
      Math.abs(point.y - (GRAPH_HEIGHT - GRAPH_PADDING)) <= 1
    )).length;
    const centerCount = next.filter((point) => distanceFromCenter(point) < Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.22).length;
    const bounds = pointBounds(next);
    const aspectRatio = bounds.width / bounds.height;

    expect(pinnedToFrameCount).toBeLessThan(12);
    expect(centerCount).toBeGreaterThan(70);
    expect(centerCount).toBeLessThan(360);
    expect(aspectRatio).toBeGreaterThan(0.72);
    expect(aspectRatio).toBeLessThan(1.42);
  });
});
