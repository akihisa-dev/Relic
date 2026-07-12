import type { WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import type { GraphColorGroup, GraphNodePrimaryAction } from "./graphTypes";

export function moveGraphColorGroup(
  groups: GraphColorGroup[],
  draggingGroupId: string,
  targetGroupId: string
): GraphColorGroup[] {
  if (draggingGroupId === targetGroupId) return groups;

  const from = groups.findIndex((group) => group.id === draggingGroupId);
  const to = groups.findIndex((group) => group.id === targetGroupId);
  if (from < 0 || to < 0) return groups;

  const next = [...groups];
  const [moved] = next.splice(from, 1);
  if (!moved) return groups;
  next.splice(to, 0, moved);

  return next;
}

export function collectGraphNodeTags(
  nodes: WorkspaceGraphNode[],
  links: WorkspaceGraphLink[]
): Map<string, string[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const tagsByNode = new Map<string, Set<string>>();

  for (const link of links) {
    if (link.type !== "tag") continue;
    const tagNode = nodeById.get(link.target);
    if (!tagNode || tagNode.type !== "tag") continue;
    const tag = tagNode.label.replace(/^#/, "");
    const tags = tagsByNode.get(link.source) ?? new Set<string>();
    tags.add(tag);
    tagsByNode.set(link.source, tags);
  }

  return new Map([...tagsByNode.entries()].map(([nodeId, tags]) => [
    nodeId,
    [...tags].toSorted((a, b) => a.localeCompare(b, "ja"))
  ]));
}

export function graphNodeMatchesQuery(node: WorkspaceGraphNode, query: string, tags: string[]): boolean {
  const tokens = tokenizeGraphQuery(query);
  if (tokens.length === 0) return true;

  return tokens.every((rawToken) => {
    const negated = rawToken.startsWith("-");
    const token = (negated ? rawToken.slice(1) : rawToken).trim().toLocaleLowerCase();
    if (!token) return true;

    const matches = graphNodeMatchesToken(node, token, tags);
    return negated ? !matches : matches;
  });
}

export function graphNodeMatchesToken(node: WorkspaceGraphNode, token: string, tags: string[]): boolean {
  const separatorIndex = token.indexOf(":");
  if (separatorIndex > 0) {
    const key = token.slice(0, separatorIndex);
    const value = token.slice(separatorIndex + 1);
    if (!value) return false;

    if (key === "path") return (node.path ?? node.id).toLocaleLowerCase().includes(value);
    if (key === "file" || key === "name") return node.label.toLocaleLowerCase().includes(value);
    if (key === "tag") return graphNodeTagSearchText(node, tags).includes(value.replace(/^#/, ""));
    if (key === "type" || key === "is") return node.type.toLocaleLowerCase() === value;
  }

  return graphNodeSearchText(node, tags).includes(token);
}

export function graphNodeSearchText(node: WorkspaceGraphNode, tags: string[]): string {
  return [
    node.label,
    node.path ?? "",
    node.id,
    node.type,
    ...tags.map((tag) => `#${tag}`)
  ].join("\n").toLocaleLowerCase();
}

export function graphNodeTagSearchText(node: WorkspaceGraphNode, tags: string[]): string {
  return [
    node.type === "tag" ? node.label.replace(/^#/, "") : "",
    ...tags
  ].join("\n").toLocaleLowerCase();
}

export function tagSearchQueryFromNode(node: WorkspaceGraphNode): string {
  return node.label.replace(/^#/, "") || node.id.replace(/^#/, "");
}

export function graphNodePrimaryAction(node: WorkspaceGraphNode): GraphNodePrimaryAction | null {
  if (node.path) return { path: node.path, type: "file" };
  if (node.type === "tag") return { tag: tagSearchQueryFromNode(node), type: "tagSearch" };

  return null;
}

export function tokenizeGraphQuery(query: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;

  for (const match of query.matchAll(pattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    const token = value.trim();
    if (token) tokens.push(token);
  }

  return tokens;
}
