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

describe("buildGraphViewBox", () => {
  it("zoomとpanを既存通りviewBoxへ反映する", () => {
    expect(buildGraphViewBox(1, { x: 0, y: 0 })).toEqual({
      height: 520,
      width: 720,
      x: 0,
      y: 0
    });

    const panned = buildGraphViewBox(1.8, { x: 48, y: -32 });
    expect(panned.width).toBeCloseTo(400);
    expect(panned.height).toBeCloseTo(288.889);
    expect(panned.x).toBeCloseTo(208);
    expect(panned.y).toBeCloseTo(83.556);
  });

  it("zoomをグラフ表示範囲内に丸める", () => {
    expect(buildGraphViewBox(999, { x: 0, y: 0 }).width).toBeCloseTo(GRAPH_WIDTH / GRAPH_MAX_ZOOM);
    expect(buildGraphViewBox(0, { x: 0, y: 0 }).width).toBeCloseTo(GRAPH_WIDTH / GRAPH_MIN_ZOOM);
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
});
