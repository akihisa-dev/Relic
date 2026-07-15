import type { LinkObject, NodeObject } from "3d-force-graph";

import type { WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import { nodeColor } from "../graph/graphDrawingModel";
import type { VisibleGraph } from "../graph/graphDisplayModel";
import type { GraphColorGroup, GraphDrawTheme } from "../graph/graphTypes";

export type SphereNode = WorkspaceGraphNode & NodeObject & {
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
  focusIdsByNode: ReadonlyMap<string, ReadonlySet<string>>;
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
  linkOpacity: number;
  nodeRelSize: number;
}

export const SPHERE_MIN_GUIDE_RADIUS = 80;

export function sphereLayoutSettings(nodeCount: number, linkCount: number): SphereLayoutSettings {
  const safeNodeCount = Math.max(1, nodeCount);
  const averageDegree = (Math.max(0, linkCount) * 2) / safeNodeCount;
  const linkPressure = Math.max(0, averageDegree - 1);
  const countPressure = Math.min(0.5, Math.max(0, nodeCount - 300) / 1_200);
  const linkOpacityPressure = Math.min(
    0.3,
    Math.max(0, averageDegree - 2) * 0.04 + Math.max(0, nodeCount - 300) / 2_000
  );
  return {
    boundaryRadius: Math.max(180, Math.cbrt(safeNodeCount) * 55),
    chargeStrength: -Math.min(360, 60 + linkPressure * 28),
    linkDistance: Math.min(160, 30 + linkPressure * 16),
    linkOpacity: 0.48 - linkOpacityPressure,
    nodeRelSize: Math.max(2.7, 4.2 - Math.min(1, linkPressure * 0.16) - countPressure)
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
  graph: VisibleGraph
): SphereData {
  const focusIdsByNode = new Map<string, Set<string>>(
    graph.nodes.map((node) => [node.id, new Set([node.id])])
  );
  const links = graph.links.map((link) => {
    focusIdsByNode.get(link.source)?.add(link.target);
    focusIdsByNode.get(link.target)?.add(link.source);
    return {
      ...link,
      sourceId: link.source,
      targetId: link.target
    };
  });
  return {
    focusIdsByNode,
    links,
    nodes: graph.nodes.map((node) => ({
      ...node,
      val: sphereNodeValue(node)
    }))
  };
}

export function sphereNodeColors(
  graph: VisibleGraph,
  colorGroups: GraphColorGroup[],
  theme: GraphDrawTheme
): ReadonlyMap<string, string> {
  return new Map(graph.nodes.map((node) => [
    node.id,
    nodeColor(node, colorGroups, graph.tagsByNode.get(node.id) ?? [], theme)
  ]));
}

export function sphereNodeValue(node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount">): number {
  return Math.min(18, 2 + Math.sqrt(node.backlinkCount + node.linkCount + 1) * 2.2);
}

export function sphereFocusIds(data: SphereData, focusId: string | null): Set<string> {
  if (!focusId) return new Set();
  return new Set(data.focusIdsByNode.get(focusId) ?? [focusId]);
}

export function sphereLinkTouchesFocus(link: SphereLink, focusId: string | null): boolean {
  return focusId !== null && (link.sourceId === focusId || link.targetId === focusId);
}
