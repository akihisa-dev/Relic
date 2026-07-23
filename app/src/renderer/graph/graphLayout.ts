import type { WorkspaceGraph } from "../../shared/ipc";
import { graphCategoryLayouts, graphCategoryTarget } from "./graphCategoryModel";
import type {
  GraphOptions,
  GraphSimLink,
  GraphSimNode,
  GraphSimulationLinkSnapshot,
  GraphSimulationNodeSnapshot,
  GraphSimulationPositionsMessage
} from "./graphTypes";

const graphSpiralAngle = 2.399963229728653;

export function syncGraphLayout(
  graph: WorkspaceGraph,
  nodes: Map<string, GraphSimNode>
): GraphSimLink[] {
  const nextIds = new Set(graph.nodes.map((node) => node.id));
  const addedIds = new Set<string>();

  for (const id of nodes.keys()) {
    if (!nextIds.has(id)) nodes.delete(id);
  }

  graph.nodes.forEach((node, index) => {
    const current = nodes.get(node.id);
    if (current) {
      Object.assign(current, node);
      return;
    }

    const position = initialGraphNodePosition(index);
    addedIds.add(node.id);
    nodes.set(node.id, {
      ...node,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
      x: position.x,
      y: position.y
    });
  });

  const seedLayouts = new Map(
    graphCategoryLayouts(nodes.values()).map((layout) => [layout.category, layout])
  );
  const categoryIndexes = new Map<string, number>();
  for (const id of addedIds) {
    const node = nodes.get(id);
    const target = node ? graphCategoryTarget(node, seedLayouts) : null;
    if (!node || !target) continue;
    const index = categoryIndexes.get(target.category) ?? 0;
    const angle = index * graphSpiralAngle;
    const radius = Math.min(target.radius - 42, 14 * Math.sqrt(index));
    node.x = target.x + Math.cos(angle) * radius;
    node.y = target.y + Math.sin(angle) * radius;
    categoryIndexes.set(target.category, index + 1);
  }

  return graph.links.flatMap((link) => {
    const sourceNode = nodes.get(link.source);
    const targetNode = nodes.get(link.target);

    return sourceNode && targetNode ? [{ ...link, sourceNode, targetNode }] : [];
  });
}

export function initialGraphNodePosition(index: number): { x: number; y: number } {
  const angle = index * graphSpiralAngle;
  const radius = 80 + 9 * Math.sqrt(index);

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

export function graphSimulationNodes(nodes: Iterable<GraphSimNode>): GraphSimulationNodeSnapshot[] {
  return [...nodes].map((node) => ({
    backlinkCount: node.backlinkCount,
    category: node.category ?? null,
    fx: node.fx,
    fy: node.fy,
    id: node.id,
    linkCount: node.linkCount,
    vx: node.vx,
    vy: node.vy,
    x: node.x,
    y: node.y
  }));
}

export function graphSimulationLinks(links: GraphSimLink[]): GraphSimulationLinkSnapshot[] {
  return links.map((link) => ({
    count: link.count,
    source: link.source,
    target: link.target
  }));
}

export function applyGraphSimulationPositions(
  nodes: Map<string, GraphSimNode>,
  message: GraphSimulationPositionsMessage
): void {
  const values = new Float32Array(message.buffer);

  message.ids.forEach((id, index) => {
    const node = nodes.get(id);
    if (!node) return;

    const offset = index * 4;
    node.x = values[offset] ?? node.x;
    node.y = values[offset + 1] ?? node.y;
    node.vx = values[offset + 2] ?? node.vx;
    node.vy = values[offset + 3] ?? node.vy;
  });
}

export function graphNodeWeight(node: Pick<GraphSimNode, "backlinkCount" | "linkCount">): number {
  return node.backlinkCount + node.linkCount;
}

export function graphNodeBaseRadiusFromWeight(weight: number, options: Pick<GraphOptions, "nodeSizeMultiplier">): number {
  return options.nodeSizeMultiplier * Math.max(8, Math.min(3 * Math.sqrt(weight + 1), 30));
}
