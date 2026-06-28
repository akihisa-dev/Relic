import type {
  ChartEntry,
  ChronicleCalendarSettings,
  WorkspaceTreeNode
} from "../../shared/ipc";
import { parseMarkdownTags } from "../../shared/tags";
import { extractAliasesFromFrontmatterData } from "./aliasesModel";
import { collectChartEntriesForFrontmatterData } from "./chronicleData";
import { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter";
import {
  readWorkspaceFileIndex,
  type WorkspaceFileIndex,
  type WorkspaceFileIndexOperations,
  type WorkspaceFileIndexRecord
} from "./workspaceFileIndex";

export interface WorkspaceMarkdownReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat?: WorkspaceFileIndexOperations["stat"];
}

export interface WorkspaceDerivedDataOptions {
  cachePath?: string;
  fileIndex?: WorkspaceFileIndex;
  filePaths?: string[];
  fileTree?: WorkspaceTreeNode[];
  operations?: WorkspaceMarkdownReadOperations;
  parseCache?: WorkspaceDerivedDataCache;
}

export interface WorkspaceDerivedDataCache {
  aliases: Map<string, string[]>;
  chartEntries: Map<string, Record<"chronicle", ChartEntry[]>>;
  content: Map<string, string>;
  frontmatter: Map<string, ParsedFrontmatter>;
  tags: Map<string, string[]>;
}

export function createWorkspaceDerivedDataCache(): WorkspaceDerivedDataCache {
  return {
    aliases: new Map(),
    chartEntries: new Map(),
    content: new Map(),
    frontmatter: new Map(),
    tags: new Map()
  };
}

export function normalizeWorkspaceDerivedDataOptions(
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): WorkspaceDerivedDataOptions {
  if ("operations" in optionsOrOperations ||
    "fileIndex" in optionsOrOperations ||
    "fileTree" in optionsOrOperations ||
    "filePaths" in optionsOrOperations ||
    "cachePath" in optionsOrOperations ||
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
  if (options.fileIndex && hasContentForDerivedData(options.fileIndex)) {
    return options.fileIndex;
  }

  const operations = options.operations
    ? {
      readFile: (filePath: string) => options.operations!.readFile(filePath, "utf8"),
      ...(options.operations.stat ? { stat: options.operations.stat } : {})
    }
    : undefined;

  return readWorkspaceFileIndex(workspacePath, {
    cachePath: options.cachePath,
    filePaths: options.filePaths ?? options.fileIndex?.entries.map((entry) => entry.path),
    fileTree: options.fileTree,
    maxSearchFileBytes: Number.MAX_SAFE_INTEGER,
    operations
  });
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

  const parsed = parseFrontmatter(markdownContentForRecord(record, cache));
  cache.frontmatter.set(key, parsed);
  return parsed;
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
  calendars: ChronicleCalendarSettings[],
  cache: WorkspaceDerivedDataCache = createWorkspaceDerivedDataCache()
): Record<"chronicle", ChartEntry[]> {
  const key = `${cacheKeyForRecord(record)}\0${calendarCacheKey(calendars)}`;
  const cached = cache.chartEntries.get(key);
  if (cached) return cached;

  const entries = collectChartEntriesForFrontmatterData(
    record.path,
    frontmatterForRecord(record, cache).data,
    calendars
  );
  cache.chartEntries.set(key, entries);
  return entries;
}

function hasContentForDerivedData(fileIndex: WorkspaceFileIndex): boolean {
  return fileIndex.records.every((record) =>
    record.readStatus !== "ok" ||
    !record.searchable ||
    record.lines.length > 0
  );
}

function cacheKeyForRecord(record: WorkspaceFileIndexRecord): string {
  return [
    record.path,
    record.size,
    record.mtimeMs,
    record.contentHash ?? ""
  ].join("\0");
}

function calendarCacheKey(calendars: ChronicleCalendarSettings[]): string {
  return JSON.stringify(calendars.map((calendar) => [calendar.name, calendar.startYear ?? null]));
}
