import { readdir } from "node:fs/promises";
import path from "node:path";

import type { WorkspaceTreeNode } from "../../shared/ipc";

export async function readWorkspaceFileTree(workspacePath: string): Promise<WorkspaceTreeNode[]> {
  return readDirectory(workspacePath, "");
}

async function readDirectory(rootPath: string, relativeDirectory: string): Promise<WorkspaceTreeNode[]> {
  const absoluteDirectory = path.join(rootPath, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const nodes = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith("."))
      .map(async (entry): Promise<WorkspaceTreeNode | null> => {
        const relativePath = toWorkspaceRelativePath(path.join(relativeDirectory, entry.name));

        if (entry.isDirectory()) {
          return {
            children: await readDirectory(rootPath, relativePath),
            name: entry.name,
            path: relativePath,
            type: "folder"
          };
        }

        if (entry.isFile() && path.extname(entry.name) === ".md") {
          return {
            name: path.basename(entry.name, ".md"),
            path: relativePath,
            type: "file"
          };
        }

        return null;
      })
  );

  return nodes.filter(isTreeNode).sort(compareTreeNodes);
}

function compareTreeNodes(a: WorkspaceTreeNode, b: WorkspaceTreeNode): number {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }

  return a.name.localeCompare(b.name, "ja");
}

function isTreeNode(value: WorkspaceTreeNode | null): value is WorkspaceTreeNode {
  return value !== null;
}

function toWorkspaceRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
