import type { WorkspaceTreeNode } from "../shared/ipc";

export const joinWorkspacePath = (folder: string, name: string): string => (
  folder ? `${folder}/${name}` : name
);

export const parentFolderOf = (path: string): string => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

export const displayNameFromPath = (path: string): string => {
  const name = path.split("/").at(-1) ?? path;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
};

export function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
