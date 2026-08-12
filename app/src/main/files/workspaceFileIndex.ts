import type { Stats } from "node:fs";
import path from "node:path";

import type { WorkspaceFileKind, WorkspaceTreeNode } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath } from "./paths";
import { mapWithConcurrency } from "./concurrency";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";
import {
  readCachedWorkspaceFileIndexRecords,
  writeCachedWorkspaceFileIndexRecords,
  getWorkspaceFileIndexCacheGeneration
} from "./workspaceFileIndexCache";
import {
  defaultWorkspaceFileIndexOperations,
  workspaceFileContentHash,
  type WorkspaceFileIndexOperations
} from "./workspaceFileIndexIO";
import {
  maxWorkspaceFileIndexAggregateLineBytes,
  maxWorkspaceFileIndexLinesPerRecord,
  maxWorkspaceFileIndexRecords
} from "./workspaceFileIndexTypes";
import type {
  WorkspaceFileIndex,
  WorkspaceFileIndexRecord,
  WorkspaceFileIndexStats
} from "./workspaceFileIndexTypes";

export type { WorkspaceFileIndexOperations } from "./workspaceFileIndexIO";
export type {
  WorkspaceFileIndex,
  WorkspaceFileIndexRecord,
  WorkspaceFileIndexStats
} from "./workspaceFileIndexTypes";

export interface WorkspaceFileIndexOptions {
  cacheGeneration?: number;
  cacheOwnerPath?: string;
  cachePath?: string;
  completeSnapshot?: boolean;
  filePaths?: string[];
  fileTree?: WorkspaceTreeNode[];
  forceReadPaths?: string[];
  includeSearchContent?: boolean;
  maxSearchFileBytes?: number;
  operations?: Partial<WorkspaceFileIndexOperations>;
}

export const defaultWorkspaceFileIndexMaxSearchFileBytes = 2 * 1024 * 1024;
const mapMarkerHeadBytes = 256;
const safeWorkspaceIndexIdPattern = /^[A-Za-z0-9_-]+$/;
const maxConcurrentIndexReads = 8;

export function getWorkspaceFileIndexCachePath(userDataPath: string, workspaceId: string): string {
  if (workspaceId.trim() !== workspaceId || !safeWorkspaceIndexIdPattern.test(workspaceId)) {
    throw new Error("Invalid workspace index id.");
  }

  return path.join(userDataPath, "workspace-indexes", `${workspaceId}.json`);
}

export async function readWorkspaceFileIndex(
  workspacePath: string,
  options: WorkspaceFileIndexOptions = {}
): Promise<WorkspaceFileIndex> {
  const startedAt = startPerformanceMeasure();
  const operations = { ...defaultWorkspaceFileIndexOperations, ...options.operations };
  const stats: WorkspaceFileIndexStats = {
    cacheHitCount: 0,
    cachedContentHitCount: 0,
    cacheMissCount: 0,
    readFileCount: 0,
    readHeadCount: 0,
    statCount: 0,
    targetPathCount: 0,
    unreadableCount: 0
  };
  const includeSearchContent = options.includeSearchContent ?? true;
  const maxSearchFileBytes = options.maxSearchFileBytes ?? defaultWorkspaceFileIndexMaxSearchFileBytes;
  let cacheGeneration = options.cacheGeneration ??
    (options.cachePath ? getWorkspaceFileIndexCacheGeneration(options.cachePath) : 0);
  const cacheOwnerPath = options.cacheOwnerPath ?? workspacePath;
  const completeSnapshot = options.completeSnapshot ?? options.filePaths === undefined;
  const cacheRead = options.cachePath
    ? await readCachedWorkspaceFileIndexRecords(options.cachePath, operations, {
      expectedOwnerPath: cacheOwnerPath,
      minimumGeneration: cacheGeneration
    })
    : { generation: cacheGeneration, records: [] };
  cacheGeneration = cacheRead.generation;
  const cachedRecords = cacheRead.records;
  const cacheByPath = new Map(cachedRecords.map((record) => [record.path, record]));
  const forceReadPaths = new Set(options.forceReadPaths ?? []);
  const lineBudget = { bytes: 0 };
  const paths = options.filePaths ??
    (options.fileTree !== undefined
      ? collectMarkdownPaths(options.fileTree)
      : collectMarkdownPaths(await readWorkspaceFileTree(workspacePath)));
  const boundedPaths = paths.slice(0, maxWorkspaceFileIndexRecords);
  stats.targetPathCount = boundedPaths.length;

  const records = await mapWithConcurrency(
    boundedPaths,
    maxConcurrentIndexReads,
    async (relativePath) => {
      const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
      if (!absolutePath.ok) return unreadableRecord(relativePath);

      let fileStats: Stats;
      try {
        stats.statCount += 1;
        fileStats = await operations.stat(absolutePath.value);
      } catch {
        stats.unreadableCount += 1;
        return unreadableRecord(relativePath);
      }

      const cached = cacheByPath.get(relativePath);
      const isWithinCurrentSearchLimit = fileStats.size <= maxSearchFileBytes;
      if (
        !forceReadPaths.has(relativePath) &&
        cached?.readStatus === "ok" &&
        typeof cached.contentHash === "string" &&
        cached.size === fileStats.size &&
        cached.mtimeMs === fileStats.mtimeMs
      ) {
        stats.cacheHitCount += 1;
        if (!isWithinCurrentSearchLimit) {
          if (!cached.searchable) {
            try {
              stats.readHeadCount += 1;
              const head = await operations.readHead(absolutePath.value, mapMarkerHeadBytes);
              if (cached.contentHash === workspaceFileContentHash(head)) {
                return { ...cached, lines: [] };
              }
            } catch {
              stats.unreadableCount += 1;
              return unreadableRecord(relativePath, fileStats);
            }
          }

          return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats, lineBudget);
        }

        if (!cached.searchable) {
          return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats, lineBudget);
        }

        if (!includeSearchContent) {
          return { ...cached, lines: [] };
        }

        if (cached.lines.length > 0) {
          stats.cachedContentHitCount += 1;
          return cached;
        }

        try {
          stats.readFileCount += 1;
          const content = await operations.readFile(absolutePath.value);
          const postReadStats = await stablePostReadStats(
            absolutePath.value,
            fileStats,
            operations,
            stats
          );
          if (!postReadStats) return unreadableRecord(relativePath);
          const contentHash = workspaceFileContentHash(content);

          if (cached.contentHash === contentHash) {
            const bounded = boundedSearchLines(content, lineBudget);
            return recordFor(
              relativePath,
              postReadStats,
              cached.kind,
              bounded.lines,
              cached.searchable && bounded.searchable,
              cached.contentHash,
              cached.headHash ?? workspaceFileHeadHash(content)
            );
          }
        } catch {
          stats.unreadableCount += 1;
          return unreadableRecord(relativePath);
        }
      }

      stats.cacheMissCount += 1;
      return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats, lineBudget);
    }
  );

  const sortedRecords = records.sort((a, b) => a.path.localeCompare(b.path, "ja"));

  if (options.cachePath) {
    await writeCachedWorkspaceFileIndexRecords(options.cachePath, sortedRecords, cacheByPath, operations, {
      completeSnapshot,
      generation: cacheGeneration,
      ownerPath: cacheOwnerPath
    });
  }

  finishPerformanceMeasure("readWorkspaceFileIndex", startedAt, {
    cacheHits: stats.cacheHitCount,
    cachedContentHits: stats.cachedContentHitCount,
    cacheMisses: stats.cacheMissCount,
    markdownFiles: stats.targetPathCount,
    readFiles: stats.readFileCount,
    readHeads: stats.readHeadCount,
    statCalls: stats.statCount,
    unreadable: stats.unreadableCount
  });

  return {
    entries: sortedRecords.map(({
      contentHash: _contentHash,
      headHash: _headHash,
      lines: _lines,
      searchable: _searchable,
      ...entry
    }) => entry),
    stats,
    records: sortedRecords
  };
}

function boundedSearchLines(content: string, budget: { bytes: number }): { lines: string[]; searchable: boolean } {
  const lines = content.split("\n");
  const bytes = Buffer.byteLength(content, "utf8");
  if (
    lines.length > maxWorkspaceFileIndexLinesPerRecord ||
    budget.bytes + bytes > maxWorkspaceFileIndexAggregateLineBytes
  ) {
    return { lines: [], searchable: false };
  }
  budget.bytes += bytes;
  return { lines, searchable: true };
}

async function readIndexRecord(
  absolutePath: string,
  relativePath: string,
  fileStats: Stats,
  maxSearchFileBytes: number,
  operations: WorkspaceFileIndexOperations,
  includeSearchContent: boolean,
  stats: WorkspaceFileIndexStats,
  lineBudget: { bytes: number }
): Promise<WorkspaceFileIndexRecord> {
  if (fileStats.size > maxSearchFileBytes) {
    try {
      stats.readHeadCount += 1;
      const head = await operations.readHead(absolutePath, mapMarkerHeadBytes);
      const postReadStats = await stablePostReadStats(
        absolutePath,
        fileStats,
        operations,
        stats
      );
      if (!postReadStats) return unreadableRecord(relativePath);
      return recordFor(
        relativePath,
        postReadStats,
        "markdown",
        [],
        false,
        workspaceFileContentHash(head),
        workspaceFileContentHash(head)
      );
    } catch {
      stats.unreadableCount += 1;
      return unreadableRecord(relativePath);
    }
  }

  try {
    stats.readFileCount += 1;
    const content = await operations.readFile(absolutePath);
    const postReadStats = await stablePostReadStats(
      absolutePath,
      fileStats,
      operations,
      stats
    );
    if (!postReadStats) return unreadableRecord(relativePath);
    const bounded = includeSearchContent ? boundedSearchLines(content, lineBudget) : { lines: [], searchable: false };
    return recordFor(
      relativePath,
      postReadStats,
      "markdown",
      bounded.lines,
      includeSearchContent && bounded.searchable,
      workspaceFileContentHash(content),
      workspaceFileHeadHash(content)
    );
  } catch {
    stats.unreadableCount += 1;
    return unreadableRecord(relativePath);
  }
}

async function stablePostReadStats(
  absolutePath: string,
  initialStats: Stats,
  operations: WorkspaceFileIndexOperations,
  stats: WorkspaceFileIndexStats
): Promise<Stats | undefined> {
  let postReadStats: Stats;
  try {
    stats.statCount += 1;
    postReadStats = await operations.stat(absolutePath);
  } catch {
    stats.unreadableCount += 1;
    return undefined;
  }

  if (initialStats.size !== postReadStats.size || initialStats.mtimeMs !== postReadStats.mtimeMs) {
    stats.unreadableCount += 1;
    return undefined;
  }

  return postReadStats;
}

function recordFor(
  relativePath: string,
  fileStats: Stats,
  kind: WorkspaceFileKind,
  lines: string[],
  searchable: boolean,
  contentHash?: string,
  headHash?: string
): WorkspaceFileIndexRecord {
  return {
    kind,
    lines,
    mtimeMs: fileStats.mtimeMs,
    name: stripMarkdownExtension(path.posix.basename(relativePath)),
    path: relativePath,
    readStatus: "ok",
    searchable,
    size: fileStats.size,
    contentHash,
    headHash
  };
}

function workspaceFileHeadHash(content: string): string {
  return workspaceFileContentHash(Buffer.from(content, "utf8").subarray(0, mapMarkerHeadBytes).toString("utf8"));
}

function unreadableRecord(relativePath: string, fileStats?: Stats): WorkspaceFileIndexRecord {
  return {
    kind: "markdown",
    lines: [],
    mtimeMs: fileStats?.mtimeMs ?? 0,
    name: stripMarkdownExtension(path.posix.basename(relativePath)),
    path: relativePath,
    readStatus: "unreadable",
    searchable: false,
    size: fileStats?.size ?? 0
  };
}
