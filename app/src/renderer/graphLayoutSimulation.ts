import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../shared/ipc";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY
} from "d3-force";
import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import {
  GRAPH_CENTER_X,
  GRAPH_CENTER_Y,
  GRAPH_HEIGHT,
  GRAPH_PADDING,
  GRAPH_WIDTH,
  clamp
} from "./graphLayoutConstants";
import { buildGraphStats, emptyNodeStats } from "./graphLayoutFilters";
import type { GraphForceSettings, GraphLayoutMode, GraphPoint, GraphSimPoint } from "./graphLayoutTypes";

type D3GraphPoint = Omit<GraphSimPoint, "vx" | "vy"> & SimulationNodeDatum & {
  fx?: number | null;
  fy?: number | null;
  id: string;
  vx: number;
  vy: number;
};

interface D3GraphLink extends SimulationLinkDatum<D3GraphPoint> {
  source: string | D3GraphPoint;
  target: string | D3GraphPoint;
}

interface D3ForceProfile {
  axisStrength: number;
  centerStrength: number;
  chargeStrength: number;
  collideStrength: number;
  linkDistance: number;
  linkStrength: number;
}

export function layoutGraph(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  forceSettings: GraphForceSettings,
  layoutMode: GraphLayoutMode = "standard"
): GraphPoint[] {
  const stats = buildGraphStats(edges);
  const initial = buildLayoutSeed(nodes, edges, stats, layoutMode);

  if (initial.length <= 1) {
    return initial.map((node) => ({ ...node, x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y }));
  }

  relaxGraphLayout(initial, edges, forceSettings);

  return sortGraphPoints(initial);
}

function buildLayoutSeed(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  stats: Map<string, { incoming: number; outgoing: number }>,
  layoutMode: GraphLayoutMode
): GraphPoint[] {
  const points = nodes.map((node) => {
    const nodeStats = stats.get(node.path) ?? emptyNodeStats();
    const degree = nodeStats.incoming + nodeStats.outgoing;

    return {
      ...node,
      degree,
      incoming: nodeStats.incoming,
      outgoing: nodeStats.outgoing,
      x: GRAPH_CENTER_X,
      y: GRAPH_CENTER_Y
    };
  });

  switch (layoutMode) {
    case "radial":
      seedRadialLayout(points);
      break;
    case "cluster":
      seedClusterLayout(points, edges);
      break;
    case "scatter":
      seedScatterLayout(points);
      break;
    case "standard":
      seedStandardLayout(points);
      break;
  }

  return points;
}

function seedStandardLayout(points: GraphPoint[]): void {
  const radiusBase = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.18;
  const radiusStep = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.032;
  const maxRadius = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.42;

  points.forEach((point, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, points.length) - Math.PI / 2;
    const radius = Math.min(maxRadius, radiusBase + (index % 11) * radiusStep);
    point.x = GRAPH_CENTER_X + Math.cos(angle) * radius;
    point.y = GRAPH_CENTER_Y + Math.sin(angle) * radius;
  });
}

function seedRadialLayout(points: GraphPoint[]): void {
  const ranked = [...points].sort((a, b) => {
    const degreeDiff = b.degree - a.degree;
    return degreeDiff || a.path.localeCompare(b.path, "ja");
  });
  const maxRank = Math.max(1, ranked.length - 1);
  const minRadius = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.08;
  const radiusRange = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.38;

  ranked.forEach((point, rank) => {
    const angle = (Math.PI * 2 * rank) / Math.max(1, ranked.length) - Math.PI / 2;
    const radius = minRadius + (rank / maxRank) * radiusRange;
    point.x = GRAPH_CENTER_X + Math.cos(angle) * radius;
    point.y = GRAPH_CENTER_Y + Math.sin(angle) * radius;
  });
}

function seedScatterLayout(points: GraphPoint[]): void {
  const width = GRAPH_WIDTH - GRAPH_PADDING * 2;
  const height = GRAPH_HEIGHT - GRAPH_PADDING * 2;

  points.forEach((point) => {
    const xHash = stableHash(`${point.path}:x`);
    const yHash = stableHash(`${point.path}:y`);
    point.x = GRAPH_PADDING + width * normalizeHash(xHash);
    point.y = GRAPH_PADDING + height * normalizeHash(yHash);
  });
}

function seedClusterLayout(points: GraphPoint[], edges: WorkspaceGraphEdge[]): void {
  const pointByPath = new Map(points.map((point) => [point.path, point]));
  const adjacency = new Map(points.map((point) => [point.path, new Set<string>()]));

  edges.forEach((edge) => {
    if (!pointByPath.has(edge.sourcePath) || !pointByPath.has(edge.targetPath)) return;
    adjacency.get(edge.sourcePath)?.add(edge.targetPath);
    adjacency.get(edge.targetPath)?.add(edge.sourcePath);
  });

  const visited = new Set<string>();
  const components: GraphPoint[][] = [];
  for (const point of points) {
    if (visited.has(point.path)) continue;

    const component: GraphPoint[] = [];
    const stack = [point.path];
    visited.add(point.path);

    while (stack.length > 0) {
      const path = stack.pop();
      if (!path) continue;
      const current = pointByPath.get(path);
      if (current) component.push(current);

      for (const nextPath of adjacency.get(path) ?? []) {
        if (visited.has(nextPath)) continue;
        visited.add(nextPath);
        stack.push(nextPath);
      }
    }

    components.push(component.sort((a, b) => a.path.localeCompare(b.path, "ja")));
  }

  components.sort((a, b) => (a[0]?.path ?? "").localeCompare(b[0]?.path ?? "", "ja"));
  const centerRadius = components.length <= 1 ? 0 : Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.28;
  components.forEach((component, componentIndex) => {
    const centerAngle = (Math.PI * 2 * componentIndex) / Math.max(1, components.length) - Math.PI / 2;
    const centerX = GRAPH_CENTER_X + Math.cos(centerAngle) * centerRadius;
    const centerY = GRAPH_CENTER_Y + Math.sin(centerAngle) * centerRadius;
    const nodeRadius = component.length <= 1 ? 0 : Math.min(
      Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.18,
      Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.05 + component.length * 8
    );

    component.forEach((point, nodeIndex) => {
      const angle = (Math.PI * 2 * nodeIndex) / Math.max(1, component.length) - Math.PI / 2;
      point.x = clamp(centerX + Math.cos(angle) * nodeRadius, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
      point.y = clamp(centerY + Math.sin(angle) * nodeRadius, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
    });
  });
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeHash(hash: number): number {
  return hash / 0xffffffff;
}

function relaxGraphLayout(
  initial: GraphPoint[],
  edges: WorkspaceGraphEdge[],
  forceSettings: GraphForceSettings
): void {
  const tickCount = initial.length > 420 ? 18 : initial.length > 220 ? 36 : 96;
  const relaxed = runD3GraphSimulation(
    initial.map((point) => ({ ...point, vx: 0, vy: 0 })),
    edges,
    forceSettings,
    null,
    tickCount,
    0.68
  );

  relaxed.forEach((point, index) => {
    initial[index].x = point.x;
    initial[index].y = point.y;
  });
}

function sortGraphPoints(points: GraphPoint[]): GraphPoint[] {
  return points.sort((a, b) => {
    return a.path.localeCompare(b.path, "ja");
  });
}

export function tickGraphSimulation(
  points: GraphSimPoint[],
  edges: WorkspaceGraphEdge[],
  forceSettings: GraphForceSettings,
  pinnedPath: string | null
): GraphSimPoint[] {
  if (points.length <= 1) return points;

  return runD3GraphSimulation(points, edges, forceSettings, pinnedPath, 1, 0.24);
}

function runD3GraphSimulation(
  points: GraphSimPoint[],
  edges: WorkspaceGraphEdge[],
  forceSettings: GraphForceSettings,
  pinnedPath: string | null,
  tickCount: number,
  alpha: number
): GraphSimPoint[] {
  const visiblePaths = new Set(points.map((point) => point.path));
  const nodes: D3GraphPoint[] = points.map((point) => ({
    ...point,
    fx: point.path === pinnedPath ? point.x : null,
    fy: point.path === pinnedPath ? point.y : null,
    id: point.path,
    vx: point.path === pinnedPath ? 0 : point.vx ?? 0,
    vy: point.path === pinnedPath ? 0 : point.vy ?? 0,
    x: point.x,
    y: point.y
  }));
  const links: D3GraphLink[] = edges
    .filter((edge) => visiblePaths.has(edge.sourcePath) && visiblePaths.has(edge.targetPath))
    .map((edge) => ({ source: edge.sourcePath, target: edge.targetPath }));
  const profile = buildD3ForceProfile(points.length, forceSettings);

  const simulation = forceSimulation<D3GraphPoint>(nodes)
    .alpha(alpha)
    .alphaMin(0.001)
    .alphaDecay(0.035)
    .velocityDecay(0.34)
    .force("charge", forceManyBody<D3GraphPoint>().strength(profile.chargeStrength).theta(0.88))
    .force("link", forceLink<D3GraphPoint, D3GraphLink>(links)
      .id((node) => node.id)
      .distance(profile.linkDistance)
      .strength(profile.linkStrength))
    .force("center", forceCenter<D3GraphPoint>(GRAPH_CENTER_X, GRAPH_CENTER_Y).strength(profile.centerStrength))
    .force("x", forceX<D3GraphPoint>(GRAPH_CENTER_X).strength(profile.axisStrength))
    .force("y", forceY<D3GraphPoint>(GRAPH_CENTER_Y).strength(profile.axisStrength))
    .force("collide", forceCollide<D3GraphPoint>().radius((node) => Math.min(18, 7 + Math.sqrt(node.degree) * 1.8)).strength(profile.collideStrength))
    .stop();

  simulation.tick(tickCount);
  simulation.stop();

  return nodes.map((node) => {
    const x = clamp(node.x ?? GRAPH_CENTER_X, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
    const y = clamp(node.y ?? GRAPH_CENTER_Y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
    const isPinned = node.path === pinnedPath;

    return {
      degree: node.degree,
      folder: node.folder,
      incoming: node.incoming,
      name: node.name,
      outgoing: node.outgoing,
      path: node.path,
      tags: node.tags,
      vx: isPinned || x === GRAPH_PADDING || x === GRAPH_WIDTH - GRAPH_PADDING ? 0 : node.vx ?? 0,
      vy: isPinned || y === GRAPH_PADDING || y === GRAPH_HEIGHT - GRAPH_PADDING ? 0 : node.vy ?? 0,
      x: isPinned ? points.find((point) => point.path === node.path)?.x ?? x : x,
      y: isPinned ? points.find((point) => point.path === node.path)?.y ?? y : y
    };
  });
}

function buildD3ForceProfile(nodeCount: number, forceSettings: GraphForceSettings): D3ForceProfile {
  const density = Math.min(3.6, Math.sqrt(Math.max(1, nodeCount / 120)));

  return {
    axisStrength: 0.014 * forceSettings.centerForce * density,
    centerStrength: 0.022 * forceSettings.centerForce * density,
    chargeStrength: (-70 * forceSettings.repelForce) / density,
    collideStrength: 0.22 / Math.sqrt(density),
    linkDistance: forceSettings.linkDistance / Math.min(2.6, density),
    linkStrength: 0.052 * forceSettings.linkForce * Math.min(1.6, density)
  };
}
