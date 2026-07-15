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

export const SPHERE_NODE_PULSE_AMPLITUDE = 3.6;
export const SPHERE_NODE_PULSE_PERIOD_MS = 5_600;

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

  const amplitude = Math.min(SPHERE_NODE_PULSE_AMPLITUDE, distance * 0.25);
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
