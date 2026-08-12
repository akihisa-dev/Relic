import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import { toWorkspaceRelativePath } from "./paths";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";

interface FileTreeOperations {
  readdir(directoryPath: string, options: { withFileTypes: true }): Promise<Dirent[]>;
}

const defaultFileTreeOperations: FileTreeOperations = {
  readdir
};

export const maxWorkspaceFileTreeNodes = 100_000;
export const maxWorkspaceFileTreeDepth = 128;
export const maxWorkspaceFileTreePathBytes = 4096;
export const maxWorkspaceFileTreePathBytesTotal = 16 * 1024 * 1024;

export class WorkspaceFileTreeLimitError extends Error {
  readonly code = "WORKSPACE_FILE_TREE_LIMIT";

  constructor(message: string) {
    super(message);
    this.name = "WorkspaceFileTreeLimitError";
  }
}

export async function readWorkspaceFileTree(
  workspacePath: string,
  operations: FileTreeOperations = defaultFileTreeOperations
): Promise<WorkspaceTreeNode[]> {
  const startedAt = startPerformanceMeasure();
  const tree = await readDirectoryIteratively(workspacePath, operations);
  const stats = collectFileTreeStats(tree);
  finishPerformanceMeasure("readWorkspaceFileTree", startedAt, stats);
  return tree;
}

const defaultExcludedWorkspaceDirectories = new Set([
  "node_modules",
  "out",
  "dist",
  "build"
]);

export function isDefaultExcludedWorkspaceDirectory(name: string): boolean {
  return name.startsWith(".") || defaultExcludedWorkspaceDirectories.has(name);
}

interface DirectoryFrame {
  entries: Dirent[];
  index: number;
  nodes: WorkspaceTreeNode[];
  relativeDirectory: string;
  depth: number;
}

async function readDirectoryIteratively(
  rootPath: string,
  operations: FileTreeOperations
): Promise<WorkspaceTreeNode[]> {
  const rootEntries = await operations.readdir(rootPath, { withFileTypes: true });
  const rootNodes: WorkspaceTreeNode[] = [];
  const stack: DirectoryFrame[] = [{
    depth: 0,
    entries: rootEntries,
    index: 0,
    nodes: rootNodes,
    relativeDirectory: ""
  }];
  let nodeCount = 0;
  let pathBytesTotal = 0;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    if (frame.index >= frame.entries.length) {
      frame.nodes.sort(compareTreeNodes);
      stack.pop();
      continue;
    }

    const entry = frame.entries[frame.index++]!;
    if (isDefaultExcludedWorkspaceDirectory(entry.name)) continue;

    const relativePath = toWorkspaceRelativePath(path.join(frame.relativeDirectory, entry.name));
    const pathBytes = Buffer.byteLength(relativePath, "utf8");
    if (pathBytes > maxWorkspaceFileTreePathBytes) {
      throw new WorkspaceFileTreeLimitError("Workspace file-tree path is too long.");
    }
    pathBytesTotal += pathBytes;
    if (pathBytesTotal > maxWorkspaceFileTreePathBytesTotal) {
      throw new WorkspaceFileTreeLimitError("Workspace file-tree path budget exceeded.");
    }
    nodeCount += 1;
    if (nodeCount > maxWorkspaceFileTreeNodes) {
      throw new WorkspaceFileTreeLimitError("Workspace file-tree node limit exceeded.");
    }

    if (entry.isDirectory()) {
      if (frame.depth + 1 > maxWorkspaceFileTreeDepth) {
        throw new WorkspaceFileTreeLimitError("Workspace file-tree depth limit exceeded.");
      }
      const folderNode: WorkspaceTreeNode = {
        children: [],
        name: entry.name,
        path: relativePath,
        type: "folder"
      };
      frame.nodes.push(folderNode);
      let childEntries: Dirent[];
      try {
        childEntries = await operations.readdir(path.join(rootPath, relativePath), { withFileTypes: true });
      } catch {
        childEntries = [];
      }
      stack.push({
        depth: frame.depth + 1,
        entries: childEntries,
        index: 0,
        nodes: folderNode.children,
        relativeDirectory: relativePath
      });
      continue;
    }

    if (entry.isFile() && hasMarkdownExtension(entry.name)) {
      frame.nodes.push({ name: stripMarkdownExtension(entry.name), path: relativePath, type: "file" });
    } else if (entry.isFile() && isSupportedMarkdownImagePath(entry.name)) {
      frame.nodes.push({ kind: "image", name: entry.name, path: relativePath, type: "file" });
    } else if (entry.isFile() && isSupportedPdfPath(entry.name)) {
      frame.nodes.push({ kind: "pdf", name: entry.name, path: relativePath, type: "file" });
    }
  }

  return rootNodes;
}

function compareTreeNodes(a: WorkspaceTreeNode, b: WorkspaceTreeNode): number {
  if (a.type !== b.type) {
    return a.type === "folder" ? -1 : 1;
  }

  return a.name.localeCompare(b.name, "ja");
}

function collectFileTreeStats(nodes: WorkspaceTreeNode[]): Record<string, number> {
  let directories = 0;
  let files = 0;
  let markdownFiles = 0;

  const pending = [...nodes];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.type === "folder") {
      directories += 1;
      pending.push(...node.children);
    } else {
      files += 1;
      if (hasMarkdownExtension(node.path)) markdownFiles += 1;
    }
  }

  return { directories, files, markdownFiles };
}
