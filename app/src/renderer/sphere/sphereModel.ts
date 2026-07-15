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

export const sphereLabelLimit = 320;

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

export function sphereLabelNodes(data: SphereData): SphereNode[] {
  if (data.nodes.length <= sphereLabelLimit) return data.nodes;

  return data.nodes
    .map((node, index) => ({ index, node }))
    .sort((left, right) => {
      const leftRelations = left.node.backlinkCount + left.node.linkCount;
      const rightRelations = right.node.backlinkCount + right.node.linkCount;
      return rightRelations - leftRelations || left.index - right.index;
    })
    .slice(0, sphereLabelLimit)
    .map(({ node }) => node);
}
