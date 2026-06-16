import type { WorkspaceTreeNode } from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";

export function collectMarkdownPathsFromTree(nodes: WorkspaceTreeNode[]): string[] {
  const paths: string[] = [];

  function collect(items: WorkspaceTreeNode[]): void {
    for (const node of items) {
      if (node.type === "folder") {
        collect(node.children);
      } else if (hasMarkdownExtension(node.path)) {
        paths.push(node.path);
      }
    }
  }

  collect(nodes);
  return paths;
}

export function createWikiLinkFormatter(markdownPaths: string[]): (relativePath: string, displayName: string) => string {
  const basenameCounts = new Map<string, number>();

  for (const markdownPath of markdownPaths) {
    const basename = markdownPath.replace(/\\/g, "/").split("/").at(-1)?.replace(/\.md$/i, "") ?? markdownPath;
    basenameCounts.set(basename, (basenameCounts.get(basename) ?? 0) + 1);
  }

  return (relativePath, displayName) => {
    const normalizedPath = relativePath.replace(/\\/g, "/").replace(/\.md$/i, "");
    const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

    if ((basenameCounts.get(basename) ?? 0) === 1) {
      return displayName === basename ? `[[${basename}]]` : `[[${basename}|${displayName}]]`;
    }

    return `[[./${normalizedPath}|${displayName}]]`;
  };
}
