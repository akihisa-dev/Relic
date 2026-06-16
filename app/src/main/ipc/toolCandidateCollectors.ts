import type { Dirent, Stats } from "node:fs";
import path from "node:path";

import type { MergeFilesInput, WorkspaceTreeNode } from "../../shared/ipc";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { parseMarkdownTags } from "../../shared/tags";
import { parseFrontmatter } from "../files/frontmatter";

export interface FileCandidate {
  ctime: number;
  name?: string;
  mtime: number;
  relPath: string;
}

export interface ToolActionFileOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  readdir(directoryPath: string, options: { withFileTypes: true }): Promise<Dirent<string>[]>;
  stat(filePath: string): Promise<Stats>;
}

function isFileCandidate(candidate: FileCandidate | null): candidate is FileCandidate {
  return candidate !== null;
}

export async function collectMergeCandidates(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  const candidates: FileCandidate[] = [];

  async function collect(items: WorkspaceTreeNode[]): Promise<void> {
    await Promise.all(items.map(async (node) => {
      if (node.type === "folder") {
        await collect(node.children);
      } else {
        const absPath = path.join(workspacePath, node.path);
        try {
          const s = await operations.stat(absPath);
          candidates.push({ relPath: node.path, mtime: s.mtimeMs, ctime: s.birthtimeMs });
        } catch {
          return;
        }
      }
    }));
  }

  await collect(nodes);
  return candidates;
}

export async function filterMergeCandidates(
  workspacePath: string,
  candidates: FileCandidate[],
  input: MergeFilesInput,
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  if (input.filterType === "folder" && input.filterValue) {
    const folder = input.filterValue.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!folder) return candidates;

    return candidates.filter((file) => file.relPath === folder || file.relPath.startsWith(`${folder}/`));
  }

  if (input.filterType === "tag" && input.filterValue) {
    const tag = input.filterValue.trim().replace(/^#/, "");
    const taggedCandidates = await Promise.all(candidates.map(async (candidate) => {
      try {
        const content = await operations.readFile(path.join(workspacePath, candidate.relPath), "utf-8");
        return new Set(parseMarkdownTags(content).tags).has(tag) ? candidate : null;
      } catch {
        return null;
      }
    }));
    return taggedCandidates.filter(isFileCandidate);
  }

  if (input.filterType === "frontmatter") {
    const field = input.frontmatterField?.trim() ?? "";
    const value = input.filterValue.trim();

    if (field && value) {
      const frontmatterFiltered = await Promise.all(candidates.map(async (candidate) => {
        try {
          const content = await operations.readFile(path.join(workspacePath, candidate.relPath), "utf-8");
          const { data } = parseFrontmatter(content);

          return matchesFrontmatterField(data[field], value) ? candidate : null;
        } catch {
          return null;
        }
      }));
      return frontmatterFiltered.filter(isFileCandidate);
    }

    return [];
  }

  return candidates;
}

export function sortMergeCandidates(candidates: FileCandidate[], sortBy: MergeFilesInput["sortBy"]): void {
  if (sortBy === "mtime") candidates.sort((a, b) => b.mtime - a.mtime);
  else if (sortBy === "ctime") candidates.sort((a, b) => b.ctime - a.ctime);
  else candidates.sort((a, b) => a.relPath.localeCompare(b.relPath, "ja"));
}

export async function collectTitleListFiles(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  filterFolder: string | undefined,
  operations: ToolActionFileOperations
): Promise<{ name: string; path: string; mtime: number }[]> {
  const collected: { name: string; path: string; mtime: number }[] = [];

  async function collectFiles(items: WorkspaceTreeNode[], folderRelPath: string): Promise<void> {
    await Promise.all(items.map(async (node) => {
      if (node.type === "folder") {
        if (!filterFolder || folderRelPath === filterFolder || node.path === filterFolder) {
          await collectFiles(node.children, node.path);
        } else if (!filterFolder) {
          await collectFiles(node.children, node.path);
        }
      } else {
        if (filterFolder && !node.path.startsWith(filterFolder + "/") && node.path !== filterFolder) return;
        const absPath = path.join(workspacePath, node.path);
        try {
          const s = await operations.stat(absPath);
          collected.push({ name: node.name.replace(/\.md$/, ""), path: node.path, mtime: s.mtimeMs });
        } catch {
          return;
        }
      }
    }));
  }

  await collectFiles(nodes, "");
  return collected;
}

export async function collectTagIndexFiles(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  targetFolder: string,
  includeSubfolders: boolean,
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  const normalizedTarget = targetFolder.replace(/\\/g, "/").replace(/\/+$/, "");
  const collected: FileCandidate[] = [];

  function isTargetPath(filePath: string): boolean {
    const folder = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";

    if (!normalizedTarget) {
      return includeSubfolders || folder === "";
    }

    if (includeSubfolders) {
      return filePath.startsWith(`${normalizedTarget}/`);
    }

    return folder === normalizedTarget;
  }

  async function collect(items: WorkspaceTreeNode[]): Promise<void> {
    await Promise.all(items.map(async (node) => {
      if (node.type === "folder") {
        await collect(node.children);
        return;
      }

      if (!hasMarkdownExtension(node.path) || !isTargetPath(node.path)) return;

      try {
        const s = await operations.stat(path.join(workspacePath, node.path));
        collected.push({
          ctime: s.birthtimeMs,
          mtime: s.mtimeMs,
          name: node.name.replace(/\.md$/i, ""),
          relPath: node.path
        });
      } catch {
        return;
      }
    }));
  }

  await collect(nodes);
  return collected;
}

export async function collectTableOfContentsLines(
  dirPath: string,
  relBase: string,
  indent: number,
  includeSubfolders: boolean,
  lines: string[],
  wikiLinkForPath: (relativePath: string, displayName: string) => string,
  operations: ToolActionFileOperations,
  skipOnReadError: boolean
): Promise<boolean> {
  let entries: Dirent<string>[];

  try {
    entries = await operations.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (skipOnReadError) return false;
    throw error;
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
  for (const entry of entries) {
    const prefix = "  ".repeat(indent) + "- ";
    if (entry.isDirectory()) {
      if (includeSubfolders) {
        const childLines: string[] = [];
        const childRead = await collectTableOfContentsLines(
          path.join(dirPath, entry.name),
          path.posix.join(relBase, entry.name),
          indent + 1,
          includeSubfolders,
          childLines,
          wikiLinkForPath,
          operations,
          true
        );

        if (childRead) {
          lines.push(`${prefix}**${entry.name}/**`);
          lines.push(...childLines);
        }
      }
    } else if (hasMarkdownExtension(entry.name)) {
      const displayName = stripMarkdownExtension(entry.name);
      const fileRelativePath = path.posix.join(relBase, entry.name);
      lines.push(`${prefix}${wikiLinkForPath(fileRelativePath, displayName)}`);
    }
  }

  return true;
}

function matchesFrontmatterField(value: unknown, query: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }

  if (typeof value === "boolean") {
    const normalizedQuery = query.toLocaleLowerCase();

    if (["true", "1", "yes", "on"].includes(normalizedQuery)) {
      return value === true;
    }

    if (["false", "0", "no", "off"].includes(normalizedQuery)) {
      return value === false;
    }

    return String(value).toLocaleLowerCase() === normalizedQuery;
  }

  return String(value).toLocaleLowerCase().includes(query.toLocaleLowerCase());
}
