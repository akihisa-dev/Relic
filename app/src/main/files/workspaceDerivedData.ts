import type {
  Backlink,
  ChartEntry,
  WorkspaceTreeNode
} from "../../shared/ipc";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { parseMarkdownTags } from "../../shared/tags";
import { extractAliasesFromFrontmatterData } from "./aliasesModel";
import { collectChartEntriesForFrontmatterData } from "./chronicleData";
import {
  inspectFrontmatter,
  type InspectedFrontmatter,
  type ParsedFrontmatter
} from "./frontmatter";
import {
  readWorkspaceFileIndex,
  type WorkspaceFileIndex,
  type WorkspaceFileIndexOperations,
  type WorkspaceFileIndexRecord
} from "./workspaceFileIndex";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";

export interface WorkspaceMarkdownReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat?: WorkspaceFileIndexOperations["stat"];
}

export interface WorkspaceDerivedDataOptions {
  cacheGeneration?: number;
  cacheOwnerPath?: string;
  cachePath?: string;
  completeSnapshot?: boolean;
  fileIndex?: WorkspaceFileIndex;
  filePaths?: string[];
  fileTree?: WorkspaceTreeNode[];
  forceReadPaths?: string[];
  maxSearchFileBytes?: number;
  operations?: WorkspaceMarkdownReadOperations;
  parseCache?: WorkspaceDerivedDataCache;
}

export interface WorkspaceDerivedDataCache {
  aliases: Map<string, string[]>;
  backlinksByTarget: Map<string, Backlink[]> | null;
  chartEntries: Map<string, Record<"chronicle", ChartEntry[]>>;
  content: Map<string, string>;
  frontmatter: Map<string, ParsedFrontmatter>;
  frontmatterInspection: Map<string, InspectedFrontmatter>;
  tags: Map<string, string[]>;
}

/** Finite safety budgets for derived-data requests.  Callers cannot opt into
 * an effectively unbounded parser/index build via MAX_SAFE_INTEGER. */
export const maxWorkspaceDerivedSearchFileBytes = 16 * 1024 * 1024;
export const maxWorkspaceDerivedRecords = 100_000;

export class WorkspaceDerivedDataLimitError extends Error {
  readonly code = "WORKSPACE_DERIVED_DATA_LIMIT";

  constructor(message: string) {
    super(message);
    this.name = "WorkspaceDerivedDataLimitError";
  }
}

export function createWorkspaceDerivedDataCache(): WorkspaceDerivedDataCache {
  return {
    aliases: new Map(),
    backlinksByTarget: null,
    chartEntries: new Map(),
    content: new Map(),
    frontmatter: new Map(),
    frontmatterInspection: new Map(),
    tags: new Map()
  };
}

/**
 * Create an isolated parse-cache generation for an incremental refresh.
 * Consumers holding the previous snapshot must not observe invalidation
 * mutations while they are still deriving data from that snapshot.
 */
export function cloneWorkspaceDerivedDataCache(
  cache: WorkspaceDerivedDataCache
): WorkspaceDerivedDataCache {
  return {
    aliases: new Map(cache.aliases),
    backlinksByTarget: cache.backlinksByTarget ? new Map(cache.backlinksByTarget) : null,
    chartEntries: new Map(cache.chartEntries),
    content: new Map(cache.content),
    frontmatter: new Map(cache.frontmatter),
    frontmatterInspection: new Map(cache.frontmatterInspection),
    tags: new Map(cache.tags)
  };
}

/**
 * Discard all derived values associated with one file-index record.
 *
 * Record metadata is part of every parse-cache key, so an updated record
 * cannot reuse the old content or frontmatter-derived values. Backlinks are
 * an aggregate over all records and therefore need full invalidation too.
 */
export function discardWorkspaceDerivedDataForRecord(
  cache: WorkspaceDerivedDataCache,
  record: WorkspaceFileIndexRecord
): void {
  const key = cacheKeyForRecord(record);
  cache.aliases.delete(key);
  cache.chartEntries.delete(key);
  cache.content.delete(key);
  cache.frontmatter.delete(key);
  cache.frontmatterInspection.delete(key);
  cache.tags.delete(key);
  cache.backlinksByTarget = null;
}

export function normalizeWorkspaceDerivedDataOptions(
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): WorkspaceDerivedDataOptions {
  if ("operations" in optionsOrOperations ||
    "fileIndex" in optionsOrOperations ||
    "fileTree" in optionsOrOperations ||
    "filePaths" in optionsOrOperations ||
    "forceReadPaths" in optionsOrOperations ||
    "cachePath" in optionsOrOperations ||
    "cacheGeneration" in optionsOrOperations ||
    "cacheOwnerPath" in optionsOrOperations ||
    "completeSnapshot" in optionsOrOperations ||
    "maxSearchFileBytes" in optionsOrOperations ||
    "parseCache" in optionsOrOperations) {
    return optionsOrOperations;
  }

  if ("readFile" in optionsOrOperations) {
    return { operations: optionsOrOperations };
  }

  return {};
}

export async function readWorkspaceDerivedFileIndex(
  workspacePath: string,
  options: WorkspaceDerivedDataOptions = {}
): Promise<WorkspaceFileIndex> {
  const startedAt = startPerformanceMeasure();
  const maxSearchFileBytes = boundedDerivedSearchFileBytes(options.maxSearchFileBytes);
  if (options.fileIndex && options.fileIndex.records.length > maxWorkspaceDerivedRecords) {
    throw new WorkspaceDerivedDataLimitError("Workspace derived-data record limit exceeded.");
  }
  if (options.fileIndex && hasContentForDerivedData(options.fileIndex, maxSearchFileBytes)) {
    finishPerformanceMeasure("readWorkspaceDerivedFileIndex", startedAt, {
      reusedFileIndex: true,
      records: options.fileIndex.records.length
    });
    return options.fileIndex;
  }

  const operations = options.operations
    ? {
      readFile: (filePath: string) => options.operations!.readFile(filePath, "utf8"),
      ...(options.operations.stat ? { stat: options.operations.stat } : {})
    }
    : undefined;

  const targetPaths = options.filePaths ?? (
    options.fileTree !== undefined
      ? collectMarkdownPaths(options.fileTree)
      : options.fileIndex?.records.map((record) => record.path)
  );
  const pathsToRead = options.fileIndex && targetPaths
    ? targetPaths.filter((relativePath) => {
      const record = options.fileIndex?.records.find((item) => item.path === relativePath);
      return !record || !hasContentForDerivedData({
        entries: [],
        records: [record],
        stats: options.fileIndex?.stats ?? emptyWorkspaceFileIndexStats()
      }, maxSearchFileBytes);
    })
    : targetPaths;

  const pathsToReturn = options.fileIndex && targetPaths
    ? targetPaths
    : undefined;
  if (targetPaths && targetPaths.length > maxWorkspaceDerivedRecords) {
    throw new WorkspaceDerivedDataLimitError("Workspace derived-data path limit exceeded.");
  }
  if (options.fileIndex && pathsToRead && pathsToRead.length === 0) {
    if (!pathsToReturn) return options.fileIndex;
    const records = pathsToReturn
      .map((relativePath) => options.fileIndex?.records.find((record) => record.path === relativePath))
      .filter((record): record is WorkspaceFileIndexRecord => !!record)
      .sort((a, b) => a.path.localeCompare(b.path, "ja"));
    return {
      ...options.fileIndex,
      entries: records.map(({
        contentHash: _contentHash,
        headHash: _headHash,
        lines: _lines,
        searchable: _searchable,
        ...entry
      }) => entry),
      records
    };
  }

  const fileIndex = await readWorkspaceFileIndex(workspacePath, {
    cachePath: options.cachePath,
    cacheGeneration: options.cacheGeneration,
    cacheOwnerPath: options.cacheOwnerPath ?? workspacePath,
    completeSnapshot: options.completeSnapshot ?? options.fileIndex === undefined,
    filePaths: pathsToRead,
    fileTree: options.fileTree,
    forceReadPaths: options.forceReadPaths,
    maxSearchFileBytes,
    operations
  });
  if (fileIndex.records.length > maxWorkspaceDerivedRecords) {
    throw new WorkspaceDerivedDataLimitError("Workspace derived-data record limit exceeded.");
  }
  if (!options.fileIndex || !pathsToRead) return fileIndex;

  const refreshedByPath = new Map(fileIndex.records.map((record) => [record.path, record]));
  const existingByPath = new Map(options.fileIndex.records.map((record) => [record.path, record]));
  const records = (pathsToReturn ?? pathsToRead)
    .map((relativePath) => refreshedByPath.get(relativePath) ?? existingByPath.get(relativePath))
    .filter((record): record is WorkspaceFileIndexRecord => !!record)
    .sort((a, b) => a.path.localeCompare(b.path, "ja"));
  const mergedFileIndex: WorkspaceFileIndex = {
    entries: records.map(({
      contentHash: _contentHash,
      headHash: _headHash,
      lines: _lines,
      searchable: _searchable,
      ...entry
    }) => entry),
    records,
    stats: {
      ...fileIndex.stats,
      targetPathCount: records.length
    }
  };
  finishPerformanceMeasure("readWorkspaceDerivedFileIndex", startedAt, {
    records: mergedFileIndex.records.length,
    reusedFileIndex: false
  });
  return mergedFileIndex;
}

function boundedDerivedSearchFileBytes(requested: number | undefined): number {
  if (requested === undefined) return maxWorkspaceDerivedSearchFileBytes;
  if (!Number.isFinite(requested) || requested < 0) return 0;
  return Math.min(Math.floor(requested), maxWorkspaceDerivedSearchFileBytes);
}

export function readableWorkspaceMarkdownRecords(fileIndex: WorkspaceFileIndex): WorkspaceFileIndexRecord[] {
  return fileIndex.records.filter((record) =>
    record.readStatus === "ok" &&
    record.searchable
  );
}

export function markdownContentForRecord(
  record: WorkspaceFileIndexRecord,
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): string {
  const key = cacheKeyForRecord(record);
  const cached = cache.content.get(key);
  if (cached !== undefined) return cached;

  const content = record.lines.join("\n");
  cache.content.set(key, content);
  return content;
}

export function frontmatterForRecord(
  record: WorkspaceFileIndexRecord,
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): ParsedFrontmatter {
  const key = cacheKeyForRecord(record);
  const cached = cache.frontmatter.get(key);
  if (cached) return cached;

  const inspected = inspectedFrontmatterForRecord(record, cache);
  const parsed = { body: inspected.body, data: inspected.data };
  cache.frontmatter.set(key, parsed);
  return parsed;
}

export function inspectedFrontmatterForRecord(
  record: WorkspaceFileIndexRecord,
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): InspectedFrontmatter {
  const key = cacheKeyForRecord(record);
  const cached = cache.frontmatterInspection.get(key);
  if (cached) return cached;

  const inspected = inspectFrontmatter(markdownContentForRecord(record, cache));
  cache.frontmatterInspection.set(key, inspected);
  return inspected;
}

export function tagsForRecord(
  record: WorkspaceFileIndexRecord,
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): string[] {
  const key = cacheKeyForRecord(record);
  const cached = cache.tags.get(key);
  if (cached) return cached;

  const tags = parseMarkdownTags(markdownContentForRecord(record, cache)).tags;
  cache.tags.set(key, tags);
  return tags;
}

export function aliasesForRecord(
  record: WorkspaceFileIndexRecord,
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): string[] {
  const key = cacheKeyForRecord(record);
  const cached = cache.aliases.get(key);
  if (cached) return cached;

  const aliases = extractAliasesFromFrontmatterData(frontmatterForRecord(record, cache).data);
  cache.aliases.set(key, aliases);
  return aliases;
}

export function chartEntriesForRecord(
  record: WorkspaceFileIndexRecord,
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): Record<"chronicle", ChartEntry[]> {
  const key = cacheKeyForRecord(record);
  const cached = cache.chartEntries.get(key);
  if (cached) return cached;

  const entries = collectChartEntriesForFrontmatterData(
    record.path,
    frontmatterForRecord(record, cache).data
  );
  cache.chartEntries.set(key, entries);
  return entries;
}

function hasContentForDerivedData(fileIndex: WorkspaceFileIndex, maxSearchFileBytes: number): boolean {
  return fileIndex.records.every((record) => {
    if (record.readStatus !== "ok") {
      return true;
    }

    if (record.size > maxSearchFileBytes) {
      return !record.searchable;
    }

    return record.searchable && record.lines.length > 0;
  });
}

function emptyWorkspaceFileIndexStats(): WorkspaceFileIndex["stats"] {
  return {
    cacheHitCount: 0,
    cachedContentHitCount: 0,
    cacheMissCount: 0,
    readFileCount: 0,
    readHeadCount: 0,
    statCount: 0,
    targetPathCount: 0,
    unreadableCount: 0
  };
}

function cacheKeyForRecord(record: WorkspaceFileIndexRecord): string {
  return [
    record.path,
    record.size,
    record.mtimeMs,
    record.contentHash ?? ""
  ].join("\0");
}
