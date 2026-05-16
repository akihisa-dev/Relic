import type { WorkspaceGraph, WorkspaceGraphEdge, WorkspaceGraphNode } from "../shared/ipc";
import type { GraphGroup } from "./store/graphStore";
import type { BuildFilteredGraphInput, GraphViewModel, NodeStats } from "./graphLayoutTypes";

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

export function emptyNodeStats(): NodeStats {
  return { incoming: 0, outgoing: 0 };
}
