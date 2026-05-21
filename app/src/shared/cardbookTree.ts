import type { CardbookTreeNode } from "./ipc";

export function collectMarkdownCardPaths(nodes: CardbookTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "card" ? [node.path] : collectMarkdownCardPaths(node.children)
  );
}
