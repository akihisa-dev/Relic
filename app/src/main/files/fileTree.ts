import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import { toWorkspaceRelativePath } from "./paths";
import { mapWithConcurrency } from "./concurrency";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";

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
  const startedAt = startPerformanceMeasure();
  const tree = await readDirectory(workspacePath, "", operations);
  const stats = collectFileTreeStats(tree);
  finishPerformanceMeasure("readWorkspaceFileTree", startedAt, stats);
  return tree;
}

const maxConcurrentDirectoryReads = 8;
const defaultExcludedWorkspaceDirectories = new Set([
  "node_modules",
  "out",
  "dist",
  "build"
]);

export function isDefaultExcludedWorkspaceDirectory(name: string): boolean {
  return name.startsWith(".") || defaultExcludedWorkspaceDirectories.has(name);
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

  const nodeReads = entries.filter((entry) => !isDefaultExcludedWorkspaceDirectory(entry.name));
  const nodes = await mapWithConcurrency<Dirent, WorkspaceTreeNode | null>(
    nodeReads,
    maxConcurrentDirectoryReads,
    async (entry) => {
      const relativePath = toWorkspaceRelativePath(path.join(relativeDirectory, entry.name));

      if (entry.isDirectory()) {
        return {
          children: await readDirectory(rootPath, relativePath, operations),
          name: entry.name,
          path: relativePath,
          type: "folder"
        };
      }

      if (entry.isFile() && hasMarkdownExtension(entry.name)) {
        return {
          name: stripMarkdownExtension(entry.name),
          path: relativePath,
          type: "file"
        };
      }

      if (entry.isFile() && isSupportedMarkdownImagePath(entry.name)) {
        return {
          kind: "image",
          name: entry.name,
          path: relativePath,
          type: "file"
        };
      }

      if (entry.isFile() && isSupportedPdfPath(entry.name)) {
        return {
          kind: "pdf",
          name: entry.name,
          path: relativePath,
          type: "file"
        };
      }

      return null;
    }
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

function collectFileTreeStats(nodes: WorkspaceTreeNode[]): Record<string, number> {
  let directories = 0;
  let files = 0;
  let markdownFiles = 0;

  for (const node of nodes) {
    if (node.type === "folder") {
      directories += 1;
      const childStats = collectFileTreeStats(node.children);
      directories += childStats.directories;
      files += childStats.files;
      markdownFiles += childStats.markdownFiles;
      continue;
    }

    files += 1;
    if (hasMarkdownExtension(node.path)) markdownFiles += 1;
  }

  return { directories, files, markdownFiles };
}
