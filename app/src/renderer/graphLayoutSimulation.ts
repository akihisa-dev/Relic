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
import type { Force, SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
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
  containmentRadius: number;
  containmentStrength: number;
  linkDistance: number;
  linkStrength: number;
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5));
const graphSafetyMinX = GRAPH_CENTER_X - GRAPH_WIDTH * 2;
const graphSafetyMaxX = GRAPH_CENTER_X + GRAPH_WIDTH * 2;
const graphSafetyMinY = GRAPH_CENTER_Y - GRAPH_HEIGHT * 2;
const graphSafetyMaxY = GRAPH_CENTER_Y + GRAPH_HEIGHT * 2;

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
  const spacing = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.014;
  const jitterRadius = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.012;

  points.forEach((point, index) => {
    const radius = spacing * Math.sqrt(index + 1);
    const angle = index * goldenAngle;
    const jitterAngle = normalizeHash(stableHash(`${point.path}:angle`)) * Math.PI * 2;
    const jitter = (normalizeHash(stableHash(`${point.path}:jitter`)) - 0.5) * jitterRadius;
    point.x = GRAPH_CENTER_X + Math.cos(angle) * radius + Math.cos(jitterAngle) * jitter;
    point.y = GRAPH_CENTER_Y + Math.sin(angle) * radius + Math.sin(jitterAngle) * jitter;
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
      point.x = centerX + Math.cos(angle) * nodeRadius;
      point.y = centerY + Math.sin(angle) * nodeRadius;
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
  const tickCount = initial.length > 700 ? 10 : initial.length > 420 ? 14 : initial.length > 220 ? 26 : 72;
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
  pinnedPath: string | null,
  tickCount = 1
): GraphSimPoint[] {
  if (points.length <= 1) return points;

  return runD3GraphSimulation(points, edges, forceSettings, pinnedPath, tickCount, tickCount > 1 ? 0.32 : 0.24);
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
    .force("contain", forceCircularContainment(profile.containmentRadius, profile.containmentStrength))
    .force("collide", forceCollide<D3GraphPoint>().radius(4.8).strength(profile.collideStrength))
    .stop();

  simulation.tick(tickCount);
  simulation.stop();

  return nodes.map((node) => {
    const x = clampFinitePosition(node.x, GRAPH_CENTER_X, graphSafetyMinX, graphSafetyMaxX);
    const y = clampFinitePosition(node.y, GRAPH_CENTER_Y, graphSafetyMinY, graphSafetyMaxY);
    const isPinned = node.path === pinnedPath;

    return {
      degree: node.degree,
      folder: node.folder,
      incoming: node.incoming,
      name: node.name,
      outgoing: node.outgoing,
      path: node.path,
      tags: node.tags,
      vx: isPinned || x !== node.x ? 0 : node.vx ?? 0,
      vy: isPinned || y !== node.y ? 0 : node.vy ?? 0,
      x: isPinned ? points.find((point) => point.path === node.path)?.x ?? x : x,
      y: isPinned ? points.find((point) => point.path === node.path)?.y ?? y : y
    };
  });
}

function buildD3ForceProfile(nodeCount: number, forceSettings: GraphForceSettings): D3ForceProfile {
  const density = Math.min(3.8, Math.sqrt(Math.max(1, nodeCount / 150)));
  const radiusScale = Math.min(1, Math.max(0.62, Math.sqrt(Math.max(1, nodeCount)) / 38));

  return {
    axisStrength: 0.034 * forceSettings.centerForce,
    centerStrength: 0.19,
    chargeStrength: (-18 * forceSettings.repelForce) / density,
    collideStrength: 0.07 / Math.sqrt(density),
    containmentRadius: Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.32 * radiusScale,
    containmentStrength: 0.018 * forceSettings.centerForce * density,
    linkDistance: forceSettings.linkDistance / Math.min(4.2, density * 1.18),
    linkStrength: 0.054 * forceSettings.linkForce * Math.min(1.65, density)
  };
}

function forceCircularContainment(radius: number, strength: number): Force<D3GraphPoint, undefined> {
  let nodes: D3GraphPoint[] = [];
  const force = ((alpha: number): void => {
    const scaledStrength = strength * alpha;
    for (const node of nodes) {
      const x = node.x ?? GRAPH_CENTER_X;
      const y = node.y ?? GRAPH_CENTER_Y;
      const dx = x - GRAPH_CENTER_X;
      const dy = y - GRAPH_CENTER_Y;
      const distance = Math.hypot(dx, dy);
      if (distance <= radius || distance === 0) continue;

      const pull = (distance - radius) * scaledStrength;
      node.vx -= (dx / distance) * pull;
      node.vy -= (dy / distance) * pull;
    }
  }) as Force<D3GraphPoint, undefined>;

  force.initialize = (nextNodes): void => {
    nodes = nextNodes;
  };

  return force;
}

function clampFinitePosition(value: number | undefined, fallback: number, min: number, max: number): number {
  const finiteValue = value ?? fallback;
  if (!Number.isFinite(finiteValue)) return fallback;
  return clamp(finiteValue, min, max);
}
