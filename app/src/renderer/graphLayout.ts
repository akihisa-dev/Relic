import type { WorkspaceGraph, WorkspaceGraphEdge, WorkspaceGraphNode } from "../shared/ipc";
import type { GraphGroup, GraphLinkFilter } from "./store/graphStore";

export interface GraphPoint extends WorkspaceGraphNode {
  degree: number;
  incoming: number;
  outgoing: number;
  x: number;
  y: number;
}

export interface GraphSimPoint extends GraphPoint {
  vx: number;
  vy: number;
}

export interface GraphViewModel {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}

export interface GraphForceSettings {
  centerForce: number;
  linkDistance: number;
  linkForce: number;
  repelForce: number;
}

export interface GraphPan {
  x: number;
  y: number;
}

export interface GraphViewBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface NodeStats {
  incoming: number;
  outgoing: number;
}

export interface BuildFilteredGraphInput {
  activeFilePath: string | null;
  folderFilter: string;
  graph: WorkspaceGraph | null;
  linkFilter: GraphLinkFilter;
  localGraphDepth: number;
  minDegree: number;
  query: string;
  showOrphans: boolean;
  tagFilter: string;
}

export const GRAPH_WIDTH = 720;
export const GRAPH_HEIGHT = 520;
export const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
export const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;
export const GRAPH_PADDING = 28;
export const GRAPH_MIN_ZOOM = 0.7;
export const GRAPH_MAX_ZOOM = 1.8;

export function buildGraphFolders(graph: WorkspaceGraph | null): string[] {
  if (!graph) return [];

  return [...new Set(graph.nodes.map((node) => node.folder).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function buildGraphTags(graph: WorkspaceGraph | null): string[] {
  if (!graph) return [];

  return [...new Set(graph.nodes.flatMap((node) => node.tags))]
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function buildGraphViewBox(zoom: number, pan: GraphPan): GraphViewBox {
  const safeZoom = clamp(zoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
  const width = GRAPH_WIDTH / safeZoom;
  const height = GRAPH_HEIGHT / safeZoom;

  return {
    height,
    width,
    x: GRAPH_CENTER_X - (width / 2) + pan.x,
    y: GRAPH_CENTER_Y - (height / 2) + pan.y
  };
}

export function buildFilteredGraph({
  activeFilePath,
  folderFilter,
  graph,
  linkFilter,
  localGraphDepth,
  minDegree,
  query,
  showOrphans,
  tagFilter
}: BuildFilteredGraphInput): GraphViewModel {
  if (!graph) return { edges: [], nodes: [] };

  const graphStats = buildGraphStats(graph.edges);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const nodes = graph.nodes.filter((node) => {
    const stats = graphStats.get(node.path) ?? emptyNodeStats();
    const degree = stats.incoming + stats.outgoing;

    if (folderFilter && node.folder !== folderFilter) return false;
    if (tagFilter && !node.tags.includes(tagFilter)) return false;
    if (linkFilter === "linked" && degree === 0) return false;
    if (linkFilter === "unlinked" && degree > 0) return false;
    if (!showOrphans && degree === 0) return false;
    if (degree < minDegree) return false;
    if (
      normalizedQuery &&
      !node.name.toLocaleLowerCase().includes(normalizedQuery) &&
      !node.path.toLocaleLowerCase().includes(normalizedQuery)
    ) return false;
    return true;
  });
  const nodePaths = new Set(nodes.map((node) => node.path));
  const visibleLocalPaths = localGraphDepth > 0 && activeFilePath
    ? collectLocalGraphPaths(graph.edges, activeFilePath, localGraphDepth)
    : null;
  const localNodePaths = visibleLocalPaths
    ? new Set([...nodePaths].filter((path) => visibleLocalPaths.has(path)))
    : nodePaths;
  const edges = graph.edges.filter((edge) => localNodePaths.has(edge.sourcePath) && localNodePaths.has(edge.targetPath));

  return { edges, nodes: nodes.filter((node) => localNodePaths.has(node.path)) };
}

export function collectRelatedGraphPaths(edges: WorkspaceGraphEdge[], focusedPath: string | null): Set<string> {
  if (!focusedPath) return new Set<string>();

  const paths = new Set([focusedPath]);
  for (const edge of edges) {
    if (edge.sourcePath === focusedPath) paths.add(edge.targetPath);
    if (edge.targetPath === focusedPath) paths.add(edge.sourcePath);
  }
  return paths;
}

export function buildGroupByPath(nodes: WorkspaceGraphNode[], groups: GraphGroup[]): Map<string, GraphGroup> {
  const activeGroups = groups.filter((group) => group.query.trim());
  if (activeGroups.length === 0) return new Map<string, GraphGroup>();

  const result = new Map<string, GraphGroup>();
  for (const node of nodes) {
    const group = activeGroups.find((candidate) => matchesGraphGroup(node, candidate.query));
    if (group) result.set(node.path, group);
  }
  return result;
}

export function buildGraphStats(edges: WorkspaceGraphEdge[]): Map<string, NodeStats> {
  const stats = new Map<string, NodeStats>();

  for (const edge of edges) {
    const source = stats.get(edge.sourcePath) ?? emptyNodeStats();
    const target = stats.get(edge.targetPath) ?? emptyNodeStats();
    source.outgoing += 1;
    target.incoming += 1;
    stats.set(edge.sourcePath, source);
    stats.set(edge.targetPath, target);
  }

  return stats;
}

export function matchesGraphGroup(node: WorkspaceGraphNode, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return false;

  if (normalizedQuery.startsWith("#")) {
    const tagQuery = normalizedQuery.slice(1);
    return node.tags.some((tag) => tag.toLocaleLowerCase().includes(tagQuery));
  }

  if (normalizedQuery.startsWith("folder:")) {
    const folderQuery = normalizedQuery.slice("folder:".length).trim();
    return node.folder.toLocaleLowerCase().includes(folderQuery);
  }

  return (
    node.name.toLocaleLowerCase().includes(normalizedQuery) ||
    node.path.toLocaleLowerCase().includes(normalizedQuery) ||
    node.folder.toLocaleLowerCase().includes(normalizedQuery) ||
    node.tags.some((tag) => tag.toLocaleLowerCase().includes(normalizedQuery))
  );
}

export function collectLocalGraphPaths(edges: WorkspaceGraphEdge[], centerPath: string, depth: number): Set<string> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const sourceNeighbors = adjacency.get(edge.sourcePath) ?? new Set<string>();
    const targetNeighbors = adjacency.get(edge.targetPath) ?? new Set<string>();
    sourceNeighbors.add(edge.targetPath);
    targetNeighbors.add(edge.sourcePath);
    adjacency.set(edge.sourcePath, sourceNeighbors);
    adjacency.set(edge.targetPath, targetNeighbors);
  }

  const visible = new Set([centerPath]);
  let frontier = new Set([centerPath]);

  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const nextFrontier = new Set<string>();
    for (const path of frontier) {
      for (const neighbor of adjacency.get(path) ?? []) {
        if (!visible.has(neighbor)) {
          visible.add(neighbor);
          nextFrontier.add(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return visible;
}

export function layoutGraph(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  forceSettings: GraphForceSettings
): GraphPoint[] {
  const stats = buildGraphStats(edges);
  const initial = nodes.map((node, index) => {
    const nodeStats = stats.get(node.path) ?? emptyNodeStats();
    const degree = nodeStats.incoming + nodeStats.outgoing;
    const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;
    const radius = Math.min(190, 96 + (index % 7) * 17);

    return {
      ...node,
      degree,
      incoming: nodeStats.incoming,
      outgoing: nodeStats.outgoing,
      x: GRAPH_CENTER_X + Math.cos(angle) * radius,
      y: GRAPH_CENTER_Y + Math.sin(angle) * radius
    };
  });

  if (initial.length <= 1) {
    return initial.map((node) => ({ ...node, x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y }));
  }

  const linkedPairs = edges
    .map((edge) => ({
      sourceIndex: initial.findIndex((node) => node.path === edge.sourcePath),
      targetIndex: initial.findIndex((node) => node.path === edge.targetPath)
    }))
    .filter((edge) => edge.sourceIndex >= 0 && edge.targetIndex >= 0);

  for (let tick = 0; tick < 96; tick += 1) {
    const forces = initial.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < initial.length; i += 1) {
      for (let j = i + 1; j < initial.length; j += 1) {
        const dx = initial[j].x - initial[i].x || 0.01;
        const dy = initial[j].y - initial[i].y || 0.01;
        const distanceSquared = Math.max(64, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSquared);
        const strength = (1550 * forceSettings.repelForce) / distanceSquared;
        const fx = (dx / distance) * strength;
        const fy = (dy / distance) * strength;
        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }
    }

    for (const edge of linkedPairs) {
      const source = initial[edge.sourceIndex];
      const target = initial[edge.targetIndex];
      const dx = target.x - source.x || 0.01;
      const dy = target.y - source.y || 0.01;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const preferred = forceSettings.linkDistance;
      const strength = (distance - preferred) * 0.014 * forceSettings.linkForce;
      const fx = (dx / distance) * strength;
      const fy = (dy / distance) * strength;
      forces[edge.sourceIndex].x += fx;
      forces[edge.sourceIndex].y += fy;
      forces[edge.targetIndex].x -= fx;
      forces[edge.targetIndex].y -= fy;
    }

    for (let i = 0; i < initial.length; i += 1) {
      const node = initial[i];
      const centerStrength = 0.016 * forceSettings.centerForce;
      forces[i].x += (GRAPH_CENTER_X - node.x) * centerStrength;
      forces[i].y += (GRAPH_CENTER_Y - node.y) * centerStrength;
      node.x = clamp(node.x + forces[i].x, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
      node.y = clamp(node.y + forces[i].y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
    }
  }

  return initial.sort((a, b) => {
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

  const next = points.map((point) => ({ ...point }));
  const indexByPath = new Map(next.map((point, index) => [point.path, index]));
  const forces = next.map(() => ({ x: 0, y: 0 }));
  const pinnedIndex = pinnedPath ? indexByPath.get(pinnedPath) : undefined;

  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const dx = next[j].x - next[i].x || 0.01;
      const dy = next[j].y - next[i].y || 0.01;
      const distanceSquared = Math.max(81, dx * dx + dy * dy);
      const distance = Math.sqrt(distanceSquared);
      const strength = (1320 * forceSettings.repelForce) / distanceSquared;
      const fx = (dx / distance) * strength;
      const fy = (dy / distance) * strength;
      forces[i].x -= fx;
      forces[i].y -= fy;
      forces[j].x += fx;
      forces[j].y += fy;
    }
  }

  for (const edge of edges) {
    const sourceIndex = indexByPath.get(edge.sourcePath);
    const targetIndex = indexByPath.get(edge.targetPath);
    if (sourceIndex === undefined || targetIndex === undefined) continue;

    const source = next[sourceIndex];
    const target = next[targetIndex];
    const dx = target.x - source.x || 0.01;
    const dy = target.y - source.y || 0.01;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const strength = (distance - forceSettings.linkDistance) * 0.018 * forceSettings.linkForce;
    const fx = (dx / distance) * strength;
    const fy = (dy / distance) * strength;
    forces[sourceIndex].x += fx;
    forces[sourceIndex].y += fy;
    forces[targetIndex].x -= fx;
    forces[targetIndex].y -= fy;
  }

  for (let i = 0; i < next.length; i += 1) {
    const point = next[i];
    if (i === pinnedIndex) {
      point.vx = 0;
      point.vy = 0;
      continue;
    }

    const centerStrength = 0.0055 * forceSettings.centerForce;
    forces[i].x += (GRAPH_CENTER_X - point.x) * centerStrength;
    forces[i].y += (GRAPH_CENTER_Y - point.y) * centerStrength;
    point.vx = (point.vx + forces[i].x) * 0.76;
    point.vy = (point.vy + forces[i].y) * 0.76;
    point.x = clamp(point.x + point.vx, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
    point.y = clamp(point.y + point.vy, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);

    if (point.x === GRAPH_PADDING || point.x === GRAPH_WIDTH - GRAPH_PADDING) point.vx = 0;
    if (point.y === GRAPH_PADDING || point.y === GRAPH_HEIGHT - GRAPH_PADDING) point.vy = 0;
  }

  return next;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function emptyNodeStats(): NodeStats {
  return { incoming: 0, outgoing: 0 };
}
