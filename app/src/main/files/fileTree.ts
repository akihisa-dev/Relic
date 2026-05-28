import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { toWorkspaceRelativePath } from "./paths";

interface FileTreeOperations {
  readdir(directoryPath: string, options: { withFileTypes: true }): Promise<Dirent[]>;
}

const defaultFileTreeOperations: FileTreeOperations = {
  readdir
};

export async function readWorkspaceFileTree(
  workspacePath: string,
  operations: FileTreeOperations = defaultFileTreeOperations
): Promise<WorkspaceTreeNode[]> {
  return readDirectory(workspacePath, "", operations);
}

async function readDirectory(
  rootPath: string,
  relativeDirectory: string,
  operations: FileTreeOperations
): Promise<WorkspaceTreeNode[]> {
  const absoluteDirectory = path.join(rootPath, relativeDirectory);
  let entries: Dirent[];

  try {
    entries = await operations.readdir(absoluteDirectory, { withFileTypes: true });
  } catch (error) {
    if (relativeDirectory === "") throw error;

    return [];
  }

  const nodeReads = entries.reduce<Promise<WorkspaceTreeNode | null>[]>((reads, entry) => {
    if (entry.name.startsWith(".")) return reads;

    reads.push((async (): Promise<WorkspaceTreeNode | null> => {
      const relativePath = toWorkspaceRelativePath(path.join(relativeDirectory, entry.name));

      if (entry.isDirectory()) {
        return {
          children: await readDirectory(rootPath, relativePath, operations),
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
    })());
    return reads;
  }, []);
  const nodes = await Promise.all(nodeReads);

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
