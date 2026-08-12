import type { Stats } from "node:fs";
import path from "node:path";

import type { MergeFilesInput, WorkspaceTreeNode } from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { parseMarkdownTags } from "../../shared/tags";
import { parseFrontmatter } from "../files/frontmatter";
import { mapWithConcurrency } from "../files/concurrency";

export interface FileCandidate {
  ctime: number;
  name?: string;
  mtime: number;
  relPath: string;
}

export interface ToolActionFileOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat(filePath: string): Promise<Stats>;
}

export const maxToolCandidateFiles = 50_000;
export const maxToolCandidateReadBytes = 4 * 1024 * 1024;
export const maxToolCandidateAggregateReadBytes = 64 * 1024 * 1024;
const maxConcurrentToolCandidateReads = 8;

export interface ToolCandidateReadBudget {
  statAggregateBytes: number;
  actualAggregateBytes: number;
}

export class ToolCandidateLimitError extends Error {
  readonly code = "TOOL_CANDIDATE_LIMIT";

  constructor(message: string) {
    super(message);
    this.name = "ToolCandidateLimitError";
  }
}

export async function readToolCandidateContent(
  workspacePath: string,
  candidate: Pick<FileCandidate, "relPath">,
  operations: ToolActionFileOperations,
  budget: ToolCandidateReadBudget
): Promise<string> {
  const filePath = path.join(workspacePath, candidate.relPath);
  const stats = await operations.stat(filePath);
  if (!Number.isSafeInteger(stats.size) || stats.size < 0 || stats.size > maxToolCandidateReadBytes) {
    throw new ToolCandidateLimitError("Tool candidate file size limit exceeded.");
  }
  budget.statAggregateBytes += stats.size;
  if (!Number.isSafeInteger(budget.statAggregateBytes) || budget.statAggregateBytes > maxToolCandidateAggregateReadBytes) {
    throw new ToolCandidateLimitError("Tool candidate aggregate read limit exceeded.");
  }

  const content = await operations.readFile(filePath, "utf-8");
  const actualBytes = Buffer.byteLength(content, "utf8");
  if (actualBytes > maxToolCandidateReadBytes) {
    throw new ToolCandidateLimitError("Tool candidate file size limit exceeded.");
  }
  budget.actualAggregateBytes += actualBytes;
  if (!Number.isSafeInteger(budget.actualAggregateBytes) || budget.actualAggregateBytes > maxToolCandidateAggregateReadBytes) {
    throw new ToolCandidateLimitError("Tool candidate aggregate read limit exceeded.");
  }
  return content;
}

function isFileCandidate(candidate: FileCandidate | null): candidate is FileCandidate {
  return candidate !== null;
}

export async function collectMergeCandidates(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  const files = flattenTreeFiles(nodes);
  assertCandidateCount(files.length);
  const candidates = await mapWithConcurrency(files, maxConcurrentToolCandidateReads, async (node) => {
    try {
      const s = await operations.stat(path.join(workspacePath, node.path));
      return { relPath: node.path, mtime: s.mtimeMs, ctime: s.birthtimeMs } satisfies FileCandidate;
    } catch {
      return null;
    }
  });
  return candidates.filter(isFileCandidate);
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
      const taggedCandidates = await mapCandidatesWithBoundedRead(workspacePath, candidates, operations, (content, candidate) =>
      new Set(parseMarkdownTags(content).tags).has(tag) ? candidate : null
    );
    return taggedCandidates.filter(isFileCandidate);
  }

  if (input.filterType === "frontmatter") {
    const field = input.frontmatterField?.trim() ?? "";
    const value = input.filterValue.trim();

    if (field && value) {
      const frontmatterFiltered = await mapCandidatesWithBoundedRead(workspacePath, candidates, operations, (content, candidate) => {
        const { data } = parseFrontmatter(content);
        return Object.prototype.hasOwnProperty.call(data, field) && matchesFrontmatterField(data[field], value)
          ? candidate
          : null;
      });
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
  const files = flattenTreeFiles(nodes).filter((node) =>
    !filterFolder || node.path === filterFolder || node.path.startsWith(`${filterFolder}/`)
  );
  assertCandidateCount(files.length);
  const collected = await mapWithConcurrency(files, maxConcurrentToolCandidateReads, async (node) => {
    try {
      const s = await operations.stat(path.join(workspacePath, node.path));
      return { name: node.name.replace(/\.md$/, ""), path: node.path, mtime: s.mtimeMs };
    } catch {
      return null;
    }
  });
  return collected.filter((candidate): candidate is { name: string; path: string; mtime: number } => candidate !== null);
}

export async function collectTagIndexFiles(
  workspacePath: string,
  nodes: WorkspaceTreeNode[],
  operations: ToolActionFileOperations
): Promise<FileCandidate[]> {
  const files = flattenTreeFiles(nodes).filter((node) => hasMarkdownExtension(node.path));
  assertCandidateCount(files.length);
  const collected = await mapWithConcurrency(files, maxConcurrentToolCandidateReads, async (node) => {
    try {
      const s = await operations.stat(path.join(workspacePath, node.path));
      return {
        ctime: s.birthtimeMs,
        mtime: s.mtimeMs,
        name: node.name.replace(/\.md$/i, ""),
        relPath: node.path
      } satisfies FileCandidate;
    } catch {
      return null;
    }
  });
  return collected.filter((candidate): candidate is { ctime: number; mtime: number; name: string; relPath: string } => candidate !== null);
}

function flattenTreeFiles(nodes: WorkspaceTreeNode[]): Array<Extract<WorkspaceTreeNode, { type: "file" }>> {
  const files: Array<Extract<WorkspaceTreeNode, { type: "file" }>> = [];
  const pending = [...nodes];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.type === "folder") pending.push(...node.children);
    else files.push(node);
  }
  return files;
}

function assertCandidateCount(count: number): void {
  if (count > maxToolCandidateFiles) {
    throw new ToolCandidateLimitError("Tool candidate file limit exceeded.");
  }
}

async function mapCandidatesWithBoundedRead<TResult>(
  workspacePath: string,
  candidates: FileCandidate[],
  operations: ToolActionFileOperations,
  mapper: (content: string, candidate: FileCandidate) => TResult
): Promise<TResult[]> {
  assertCandidateCount(candidates.length);
  const budget: ToolCandidateReadBudget = { actualAggregateBytes: 0, statAggregateBytes: 0 };
  return mapWithConcurrency(candidates, maxConcurrentToolCandidateReads, async (candidate) => {
    try {
      const content = await readToolCandidateContent(workspacePath, candidate, operations, budget);
      return mapper(content, candidate);
    } catch (error) {
      if (error instanceof ToolCandidateLimitError) throw error;
      return null as TResult;
    }
  });
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
