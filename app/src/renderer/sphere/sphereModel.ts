import type { LinkObject, NodeObject } from "3d-force-graph";

import type { WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import { nodeColor } from "../graph/graphDrawingModel";
import type { VisibleGraph } from "../graph/graphDisplayModel";
import type { GraphColorGroup, GraphDrawTheme } from "../graph/graphTypes";

export type SphereNode = WorkspaceGraphNode & NodeObject & {
  baseColor: string;
  val: number;
};

export interface SphereLink extends LinkObject<SphereNode> {
  count: number;
  source: string | SphereNode;
  sourceId: string;
  target: string | SphereNode;
  targetId: string;
  type: WorkspaceGraphLink["type"];
}

export interface SphereData {
  links: SphereLink[];
  nodes: SphereNode[];
}

export interface SphereCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface SphereLayoutSettings {
  boundaryRadius: number;
  chargeStrength: number;
  linkDistance: number;
  nodeRelSize: number;
}

export const SPHERE_NODE_PULSE_MIN_AMPLITUDE = 3;
export const SPHERE_NODE_PULSE_MAX_AMPLITUDE = 18;
export const SPHERE_NODE_PULSE_PERIOD_MS = 4_800;
export const SPHERE_MIN_GUIDE_RADIUS = 80;

export function sphereLayoutSettings(nodeCount: number, linkCount: number): SphereLayoutSettings {
  const safeNodeCount = Math.max(1, nodeCount);
  const averageDegree = (Math.max(0, linkCount) * 2) / safeNodeCount;
  const linkPressure = Math.max(0, averageDegree - 1);
  const countPressure = Math.min(0.7, Math.max(0, nodeCount - 300) / 1_000);
  return {
    boundaryRadius: Math.max(180, Math.cbrt(safeNodeCount) * 55),
    chargeStrength: -Math.min(360, 60 + linkPressure * 28),
    linkDistance: Math.min(160, 30 + linkPressure * 16),
    nodeRelSize: Math.max(2.2, 4 - Math.min(1.2, linkPressure * 0.2) - countPressure)
  };
}

export function sphereNodeChargeStrength(
  node: Pick<SphereNode, "backlinkCount" | "linkCount">,
  settings: SphereLayoutSettings
): number {
  const degreePressure = Math.sqrt(Math.max(0, node.backlinkCount + node.linkCount - 4));
  return settings.chargeStrength * (1 + Math.min(1.5, degreePressure * 0.18));
}

export function sphereLinkDistance(
  source: Pick<SphereNode, "backlinkCount" | "linkCount"> | undefined,
  target: Pick<SphereNode, "backlinkCount" | "linkCount"> | undefined,
  settings: SphereLayoutSettings
): number {
  const sourceDegree = source ? source.backlinkCount + source.linkCount : 0;
  const targetDegree = target ? target.backlinkCount + target.linkCount : 0;
  const hubPressure = Math.sqrt(Math.max(0, Math.max(sourceDegree, targetDegree) - 4));
  return settings.linkDistance * (1 + Math.min(1, hubPressure * 0.12));
}

export function sphereCoreRadius(nodes: Array<Partial<SphereCoordinates>>): number {
  const radii = nodes.flatMap((node) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) return [];
    return [Math.hypot(node.x!, node.y!, node.z!)];
  }).sort((left, right) => left - right);
  if (radii.length === 0) return SPHERE_MIN_GUIDE_RADIUS;
  const coreIndex = Math.floor((radii.length - 1) * 0.9);
  return Math.max(SPHERE_MIN_GUIDE_RADIUS, radii[coreIndex]!);
}

export function createSphereData(
  graph: VisibleGraph,
  colorGroups: GraphColorGroup[],
  theme: GraphDrawTheme
): SphereData {
  return {
    links: graph.links.map((link) => ({
      ...link,
      sourceId: link.source,
      targetId: link.target
    })),
    nodes: graph.nodes.map((node) => ({
      ...node,
      baseColor: nodeColor(node, colorGroups, graph.tagsByNode.get(node.id) ?? [], theme),
      val: sphereNodeValue(node)
    }))
  };
}

export function sphereNodeValue(node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount">): number {
  return Math.min(18, 2 + Math.sqrt(node.backlinkCount + node.linkCount + 1) * 2.2);
}

export function sphereNodePulsePhase(nodeId: string): number {
  let hash = 0;
  for (let index = 0; index < nodeId.length; index += 1) {
    hash = (hash * 31 + nodeId.charCodeAt(index)) >>> 0;
  }
  return (hash / 0xffffffff) * Math.PI * 2;
}

export function sphereNodePulsePosition(
  coordinates: SphereCoordinates,
  elapsedMs: number,
  phase: number
): SphereCoordinates {
  const distance = Math.hypot(coordinates.x, coordinates.y, coordinates.z);
  if (!Number.isFinite(distance) || distance === 0) return coordinates;

  const amplitude = Math.min(
    SPHERE_NODE_PULSE_MAX_AMPLITUDE,
    Math.max(SPHERE_NODE_PULSE_MIN_AMPLITUDE, distance * 0.04),
    distance * 0.25
  );
  const elapsed = elapsedMs % SPHERE_NODE_PULSE_PERIOD_MS;
  const offset = Math.sin((elapsed / SPHERE_NODE_PULSE_PERIOD_MS) * Math.PI * 2 + phase) * amplitude;
  const scale = (distance + offset) / distance;
  return {
    x: coordinates.x * scale,
    y: coordinates.y * scale,
    z: coordinates.z * scale
  };
}

export function sphereFocusIds(data: SphereData, focusId: string | null): Set<string> {
  if (!focusId) return new Set();

  const ids = new Set([focusId]);
  for (const link of data.links) {
    if (link.sourceId === focusId) ids.add(link.targetId);
    if (link.targetId === focusId) ids.add(link.sourceId);
  }
  return ids;
}

export function sphereLinkTouchesFocus(link: SphereLink, focusId: string | null): boolean {
  return focusId !== null && (link.sourceId === focusId || link.targetId === focusId);
}
