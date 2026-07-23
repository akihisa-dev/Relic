import type { WorkspaceGraph, WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";

export interface VisibleGraph {
  links: WorkspaceGraphLink[];
  nodes: WorkspaceGraphNode[];
}

export function deriveVisibleGraph(graph: WorkspaceGraph | null): VisibleGraph {
  const source = graph ?? { links: [], nodes: [] };
  const nodes = source.nodes.filter((node) =>
    node.type === "file" || node.type === "unresolved"
  );
  const nodeIds = new Set(nodes.map((node) => node.id));

  const links = source.links.filter((link) =>
    nodeIds.has(link.source) &&
    nodeIds.has(link.target) &&
    link.type !== "tag"
  );

  return {
    links,
    nodes
  };
}
