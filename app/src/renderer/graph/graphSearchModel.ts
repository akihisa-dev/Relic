import type { WorkspaceGraphNode } from "../../shared/ipc";

export type GraphNodePrimaryAction =
  | { path: string; type: "file" }
  | { tag: string; type: "tagSearch" };

export function tagSearchQueryFromNode(node: WorkspaceGraphNode): string {
  return node.label.replace(/^#/, "") || node.id.replace(/^#/, "");
}

export function graphNodePrimaryAction(node: WorkspaceGraphNode): GraphNodePrimaryAction | null {
  if (node.path) return { path: node.path, type: "file" };
  if (node.type === "tag") return { tag: tagSearchQueryFromNode(node), type: "tagSearch" };

  return null;
}
