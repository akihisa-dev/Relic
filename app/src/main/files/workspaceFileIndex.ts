import type { Stats } from "node:fs";
import path from "node:path";

import type { WorkspaceFileIndexEntry, WorkspaceFileKind, WorkspaceTreeNode } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath } from "./paths";
import { mapWithConcurrency } from "./concurrency";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";
import {
  readCachedWorkspaceFileIndexRecords,
  writeCachedWorkspaceFileIndexRecords
} from "./workspaceFileIndexCache";
import {
  defaultWorkspaceFileIndexOperations,
  workspaceFileContentHash,
  type WorkspaceFileIndexOperations
} from "./workspaceFileIndexIO";

export type { WorkspaceFileIndexOperations } from "./workspaceFileIndexIO";

export interface WorkspaceFileIndex {
  entries: WorkspaceFileIndexEntry[];
  stats: WorkspaceFileIndexStats;
  records: WorkspaceFileIndexRecord[];
}

export interface WorkspaceFileIndexRecord extends WorkspaceFileIndexEntry {
  lines: string[];
  searchable: boolean;
  contentHash?: string;
}

export interface WorkspaceFileIndexOptions {
  cachePath?: string;
  filePaths?: string[];
  fileTree?: WorkspaceTreeNode[];
  includeSearchContent?: boolean;
  maxSearchFileBytes?: number;
  operations?: Partial<WorkspaceFileIndexOperations>;
}

export interface WorkspaceFileIndexStats {
  cacheHitCount: number;
  cachedContentHitCount: number;
  cacheMissCount: number;
  readFileCount: number;
  readHeadCount: number;
  statCount: number;
  targetPathCount: number;
  unreadableCount: number;
}

const defaultMaxSearchFileBytes = 2 * 1024 * 1024;
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
  const maxSearchFileBytes = options.maxSearchFileBytes ?? defaultMaxSearchFileBytes;
  const cachedRecords = options.cachePath
    ? await readCachedWorkspaceFileIndexRecords(options.cachePath, operations)
    : [];
  const cacheByPath = new Map(cachedRecords.map((record) => [record.path, record]));
  const paths = options.filePaths ??
    (options.fileTree !== undefined
      ? collectMarkdownPaths(options.fileTree)
      : collectMarkdownPaths(await readWorkspaceFileTree(workspacePath)));
  stats.targetPathCount = paths.length;

  const records = await mapWithConcurrency(
    paths,
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

          return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats);
        }

        if (!cached.searchable) {
          return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats);
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
          const contentHash = workspaceFileContentHash(content);

          if (cached.contentHash === contentHash) {
            return recordFor(relativePath, fileStats, cached.kind, content.split("\n"), cached.searchable, cached.contentHash);
          }
        } catch {
          stats.unreadableCount += 1;
          return unreadableRecord(relativePath, fileStats);
        }
      }

      stats.cacheMissCount += 1;
      return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent, stats);
    }
  );

  const sortedRecords = records.sort((a, b) => a.path.localeCompare(b.path, "ja"));

  if (options.cachePath) {
    await writeCachedWorkspaceFileIndexRecords(options.cachePath, sortedRecords, cacheByPath, operations);
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
    entries: sortedRecords.map(({ lines: _lines, searchable: _searchable, contentHash: _contentHash, ...entry }) => entry),
    stats,
    records: sortedRecords
  };
}

async function readIndexRecord(
  absolutePath: string,
  relativePath: string,
  fileStats: Stats,
  maxSearchFileBytes: number,
  operations: WorkspaceFileIndexOperations,
  includeSearchContent: boolean,
  stats: WorkspaceFileIndexStats
): Promise<WorkspaceFileIndexRecord> {
  if (fileStats.size > maxSearchFileBytes) {
    try {
      stats.readHeadCount += 1;
      const head = await operations.readHead(absolutePath, mapMarkerHeadBytes);
      return recordFor(
        relativePath,
        fileStats,
        "markdown",
        [],
        false,
        workspaceFileContentHash(head)
      );
    } catch {
      stats.unreadableCount += 1;
      return unreadableRecord(relativePath, fileStats);
    }
  }

  try {
    stats.readFileCount += 1;
    const content = await operations.readFile(absolutePath);
    return recordFor(
      relativePath,
      fileStats,
      "markdown",
      includeSearchContent ? content.split("\n") : [],
      true,
      workspaceFileContentHash(content)
    );
  } catch {
    stats.unreadableCount += 1;
    return unreadableRecord(relativePath, fileStats);
  }
}

function recordFor(
  relativePath: string,
  fileStats: Stats,
  kind: WorkspaceFileKind,
  lines: string[],
  searchable: boolean,
  contentHash?: string
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
    contentHash
  };
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
