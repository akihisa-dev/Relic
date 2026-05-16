import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../shared/ipc";
import {
  GRAPH_CENTER_X,
  GRAPH_CENTER_Y,
  GRAPH_HEIGHT,
  GRAPH_PADDING,
  GRAPH_WIDTH,
  clamp
} from "./graphLayoutConstants";
import { buildGraphStats, emptyNodeStats } from "./graphLayoutFilters";
import type { GraphForceSettings, GraphPoint, GraphSimPoint } from "./graphLayoutTypes";

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
