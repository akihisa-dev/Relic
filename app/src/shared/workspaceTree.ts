import type { WorkspaceTreeNode } from "./ipc";
import { hasMarkdownExtension } from "./markdownExtension";

export function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" && node.kind !== "image" && hasMarkdownExtension(node.path)
      ? [node.path]
      : node.type === "folder"
        ? collectMarkdownPaths(node.children)
        : []
  );
}
