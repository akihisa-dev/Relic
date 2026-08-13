import type { Stats } from "node:fs";
import { realpath } from "node:fs/promises";
import path from "node:path";

import type { WorkspaceFileKind, WorkspaceTreeNode } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath, verifyExistingWorkspacePath } from "./paths";
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
      const readTarget = await resolveWorkspaceFileReadTarget(workspacePath, relativePath, operations);
      if (!readTarget) return unreadableRecord(relativePath);

      let fileStats: Stats;
      try {
        stats.statCount += 1;
        fileStats = await operations.stat(readTarget.absolutePath);
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
        cached.mtimeMs === fileStats.mtimeMs &&
        cached.dev === fileStats.dev &&
        cached.ino === fileStats.ino &&
        cached.realPath === readTarget.realPath
      ) {
        stats.cacheHitCount += 1;
        if (!isWithinCurrentSearchLimit) {
          if (!cached.searchable) {
            try {
              const latestReadTarget = await revalidateWorkspaceFileReadTarget(
                workspacePath,
                relativePath,
                readTarget,
                operations,
                stats
              );
              if (!latestReadTarget) return unreadableRecord(relativePath, fileStats);
              stats.readHeadCount += 1;
              const head = await operations.readHead(latestReadTarget.absolutePath, mapMarkerHeadBytes);
              if (cached.contentHash === workspaceFileContentHash(head)) {
                const postReadStats = await stablePostReadStats(
                  latestReadTarget.absolutePath,
                  fileStats,
                  latestReadTarget.realPath,
                  operations,
                  stats
                );
                if (!postReadStats) return unreadableRecord(relativePath);
                return { ...cached, lines: [] };
              }
            } catch {
              stats.unreadableCount += 1;
              return unreadableRecord(relativePath, fileStats);
            }
          }

          return readIndexRecord(workspacePath, readTarget, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats, lineBudget);
        }

        if (!cached.searchable) {
          return readIndexRecord(workspacePath, readTarget, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats, lineBudget);
        }

        if (!includeSearchContent) {
          const postReadStats = await stablePostReadStats(
            readTarget.absolutePath,
            fileStats,
            readTarget.realPath,
            operations,
            stats
          );
          if (!postReadStats) return unreadableRecord(relativePath);
          return { ...cached, lines: [] };
        }

        if (cached.lines.length > 0) {
          const postReadStats = await stablePostReadStats(
            readTarget.absolutePath,
            fileStats,
            readTarget.realPath,
            operations,
            stats
          );
          if (!postReadStats) return unreadableRecord(relativePath);
          stats.cachedContentHitCount += 1;
          return cached;
        }

        try {
          const latestReadTarget = await revalidateWorkspaceFileReadTarget(
            workspacePath,
            relativePath,
            readTarget,
            operations,
            stats
          );
          if (!latestReadTarget) return unreadableRecord(relativePath, fileStats);
          stats.readFileCount += 1;
          const content = await operations.readFile(latestReadTarget.absolutePath);
          const postReadStats = await stablePostReadStats(
            latestReadTarget.absolutePath,
            fileStats,
            latestReadTarget.realPath,
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
              latestReadTarget.realPath,
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
      return readIndexRecord(workspacePath, readTarget, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats, lineBudget);
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
      dev: _dev,
      headHash: _headHash,
      ino: _ino,
      lines: _lines,
      realPath: _realPath,
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

interface WorkspaceFileReadTarget {
  absolutePath: string;
  realPath: string;
}

async function resolveWorkspaceFileReadTarget(
  workspacePath: string,
  relativePath: string,
  operations: WorkspaceFileIndexOperations
): Promise<WorkspaceFileReadTarget | undefined> {
  const realpathOperation = operations.realpath ?? realpath;
  const resolved = await resolveExistingWorkspacePath(workspacePath, relativePath, {
    realpath: realpathOperation
  });
  if (!resolved.ok) return undefined;

  const firstRealPath = await realpathOperation(resolved.value).catch(() => undefined);
  if (!firstRealPath) return undefined;

  const verified = await verifyExistingWorkspacePath(workspacePath, resolved.value, {
    realpath: realpathOperation
  });
  if (!verified.ok) return undefined;

  const verifiedRealPath = await realpathOperation(resolved.value).catch(() => undefined);
  if (!verifiedRealPath || firstRealPath !== verifiedRealPath) return undefined;

  return {
    absolutePath: resolved.value,
    realPath: verifiedRealPath
  };
}

async function revalidateWorkspaceFileReadTarget(
  workspacePath: string,
  relativePath: string,
  initialTarget: WorkspaceFileReadTarget,
  operations: WorkspaceFileIndexOperations,
  stats: WorkspaceFileIndexStats
): Promise<WorkspaceFileReadTarget | undefined> {
  const latestTarget = await resolveWorkspaceFileReadTarget(workspacePath, relativePath, operations);
  if (!latestTarget) {
    stats.unreadableCount += 1;
    return undefined;
  }

  if (initialTarget.realPath !== latestTarget.realPath) {
    stats.unreadableCount += 1;
    return undefined;
  }

  return latestTarget;
}

async function readIndexRecord(
  workspacePath: string,
  readTarget: WorkspaceFileReadTarget,
  relativePath: string,
  fileStats: Stats,
  maxSearchFileBytes: number,
  operations: WorkspaceFileIndexOperations,
  includeSearchContent: boolean,
  stats: WorkspaceFileIndexStats,
  lineBudget: { bytes: number }
): Promise<WorkspaceFileIndexRecord> {
  const latestReadTarget = await revalidateWorkspaceFileReadTarget(
    workspacePath,
    relativePath,
    readTarget,
    operations,
    stats
  );
  if (!latestReadTarget) return unreadableRecord(relativePath, fileStats);

  if (fileStats.size > maxSearchFileBytes) {
    try {
      stats.readHeadCount += 1;
      const head = await operations.readHead(latestReadTarget.absolutePath, mapMarkerHeadBytes);
      const postReadStats = await stablePostReadStats(
        latestReadTarget.absolutePath,
        fileStats,
        latestReadTarget.realPath,
        operations,
        stats
      );
      if (!postReadStats) return unreadableRecord(relativePath);
      return recordFor(
        relativePath,
        postReadStats,
        latestReadTarget.realPath,
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
    const content = await operations.readFile(latestReadTarget.absolutePath);
    const postReadStats = await stablePostReadStats(
      latestReadTarget.absolutePath,
      fileStats,
      latestReadTarget.realPath,
      operations,
      stats
    );
    if (!postReadStats) return unreadableRecord(relativePath);
    const bounded = includeSearchContent ? boundedSearchLines(content, lineBudget) : { lines: [], searchable: false };
    return recordFor(
      relativePath,
      postReadStats,
      latestReadTarget.realPath,
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
  initialRealPath: string,
  operations: WorkspaceFileIndexOperations,
  stats: WorkspaceFileIndexStats
): Promise<Stats | undefined> {
  let postReadStats: Stats;
  let postReadRealPath: string;
  try {
    stats.statCount += 1;
    postReadStats = await operations.stat(absolutePath);
    postReadRealPath = await (operations.realpath ?? realpath)(absolutePath);
  } catch {
    stats.unreadableCount += 1;
    return undefined;
  }

  if (
    initialRealPath !== postReadRealPath ||
    initialStats.dev !== postReadStats.dev ||
    initialStats.ino !== postReadStats.ino ||
    initialStats.size !== postReadStats.size ||
    initialStats.mtimeMs !== postReadStats.mtimeMs
  ) {
    stats.unreadableCount += 1;
    return undefined;
  }

  return postReadStats;
}

function recordFor(
  relativePath: string,
  fileStats: Stats,
  realPath: string,
  kind: WorkspaceFileKind,
  lines: string[],
  searchable: boolean,
  contentHash?: string,
  headHash?: string
): WorkspaceFileIndexRecord {
  return {
    dev: fileStats.dev,
    ino: fileStats.ino,
    kind,
    lines,
    mtimeMs: fileStats.mtimeMs,
    name: stripMarkdownExtension(path.posix.basename(relativePath)),
    path: relativePath,
    readStatus: "ok",
    realPath,
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
