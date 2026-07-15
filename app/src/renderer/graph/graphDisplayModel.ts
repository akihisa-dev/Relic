import type { WorkspaceGraph, WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import { collectGraphNodeTags, graphNodeMatchesQuery } from "./graphSearchModel";
import type { GraphOptions } from "./graphTypes";

export interface VisibleGraph {
  links: WorkspaceGraphLink[];
  nodes: WorkspaceGraphNode[];
  tagsByNode: Map<string, string[]>;
}

type GraphFilterOptions = Pick<
  GraphOptions,
  "hideUnresolved" | "search" | "showAttachments" | "showOrphans" | "showTags"
>;

export function deriveVisibleGraph(
  graph: WorkspaceGraph | null,
  options: GraphFilterOptions
): VisibleGraph {
  const source = graph ?? { links: [], nodes: [] };
  const tagsByNode = collectGraphNodeTags(source.nodes, source.links);
  const linkedIds = new Set<string>();

  for (const link of source.links) {
    linkedIds.add(link.source);
    linkedIds.add(link.target);
  }

  const nodeIds = new Set<string>();
  for (const node of source.nodes) {
    if (!options.showTags && node.type === "tag") continue;
    if (!options.showAttachments && node.type === "attachment") continue;
    if (options.hideUnresolved && node.type === "unresolved") continue;
    if (!options.showOrphans && !linkedIds.has(node.id)) continue;
    if (!graphNodeMatchesQuery(node, options.search, tagsByNode.get(node.id) ?? [])) continue;

    nodeIds.add(node.id);
  }

  const links = source.links.filter((link) =>
    nodeIds.has(link.source) &&
    nodeIds.has(link.target) &&
    (options.showTags || link.type !== "tag")
  );
  const connectedIds = new Set<string>();
  for (const link of links) {
    connectedIds.add(link.source);
    connectedIds.add(link.target);
  }

  return {
    links,
    nodes: source.nodes.filter((node) =>
      nodeIds.has(node.id) &&
      (options.showOrphans || connectedIds.has(node.id))
    ),
    tagsByNode
  };
}
