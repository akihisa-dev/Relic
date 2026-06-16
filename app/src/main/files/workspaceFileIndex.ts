import { mkdir, open, readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";

import type { WorkspaceFileIndexEntry, WorkspaceFileKind } from "../../shared/ipc";
import { isRelicDiagramMarkdownContent } from "../../shared/diagramMarkdown";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { atomicWriteTextFile } from "./atomicWrite";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath } from "./paths";

export interface WorkspaceFileIndex {
  entries: WorkspaceFileIndexEntry[];
  records: WorkspaceFileIndexRecord[];
}

export interface WorkspaceFileIndexRecord extends WorkspaceFileIndexEntry {
  lines: string[];
  searchable: boolean;
}

interface PersistedWorkspaceFileIndex {
  records?: unknown;
  version?: unknown;
}

interface WorkspaceFileIndexOptions {
  cachePath?: string;
  maxSearchFileBytes?: number;
  operations?: Partial<WorkspaceFileIndexOperations>;
}

interface WorkspaceFileIndexOperations {
  mkdir(directoryPath: string, options: { recursive: true }): Promise<unknown>;
  readCache(filePath: string): Promise<string>;
  readFile(filePath: string): Promise<string>;
  readHead(filePath: string, byteLength: number): Promise<string>;
  stat(filePath: string): Promise<Stats>;
  writeCache(filePath: string, content: string): Promise<void>;
}

const workspaceFileIndexCacheVersion = 2;
const defaultMaxSearchFileBytes = 2 * 1024 * 1024;
const mapMarkerHeadBytes = 256;
const safeWorkspaceIndexIdPattern = /^[A-Za-z0-9_-]+$/;

const defaultOperations: WorkspaceFileIndexOperations = {
  mkdir,
  readCache: (filePath) => readFile(filePath, "utf8"),
  readFile: (filePath) => readFile(filePath, "utf8"),
  readHead: readFileHead,
  stat,
  writeCache: atomicWriteTextFile
};

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
  const operations = { ...defaultOperations, ...options.operations };
  const maxSearchFileBytes = options.maxSearchFileBytes ?? defaultMaxSearchFileBytes;
  const cachedRecords = options.cachePath
    ? await readCachedRecords(options.cachePath, operations)
    : [];
  const cacheByPath = new Map(cachedRecords.map((record) => [record.path, record]));
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const paths = collectMarkdownPaths(fileTree);
  const records = await Promise.all(paths.map(async (relativePath) => {
    const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
    if (!absolutePath.ok) return unreadableRecord(relativePath);

    let fileStats: Stats;
    try {
      fileStats = await operations.stat(absolutePath.value);
    } catch {
      return unreadableRecord(relativePath);
    }

    const cached = cacheByPath.get(relativePath);
    if (cached && cached.size === fileStats.size && cached.mtimeMs === fileStats.mtimeMs) {
      return cached;
    }

    return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations);
  }));

  const sortedRecords = records.sort((a, b) => a.path.localeCompare(b.path, "ja"));

  if (options.cachePath) {
    await writeCachedRecords(options.cachePath, sortedRecords, operations);
  }

  return {
    entries: sortedRecords.map(({ lines: _lines, searchable: _searchable, ...entry }) => entry),
    records: sortedRecords
  };
}

async function readIndexRecord(
  absolutePath: string,
  relativePath: string,
  fileStats: Stats,
  maxSearchFileBytes: number,
  operations: WorkspaceFileIndexOperations
): Promise<WorkspaceFileIndexRecord> {
  if (fileStats.size > maxSearchFileBytes) {
    try {
      const head = await operations.readHead(absolutePath, mapMarkerHeadBytes);
      return recordFor(relativePath, fileStats, isRelicDiagramMarkdownContent(head) ? "diagram" : "markdown", [], false);
    } catch {
      return unreadableRecord(relativePath, fileStats);
    }
  }

  try {
    const content = await operations.readFile(absolutePath);
    return recordFor(
      relativePath,
      fileStats,
      isRelicDiagramMarkdownContent(content) ? "diagram" : "markdown",
      content.split("\n"),
      true
    );
  } catch {
    return unreadableRecord(relativePath, fileStats);
  }
}

function recordFor(
  relativePath: string,
  fileStats: Stats,
  kind: WorkspaceFileKind,
  lines: string[],
  searchable: boolean
): WorkspaceFileIndexRecord {
  return {
    kind,
    lines,
    mtimeMs: fileStats.mtimeMs,
    name: stripMarkdownExtension(path.posix.basename(relativePath)),
    path: relativePath,
    readStatus: "ok",
    searchable,
    size: fileStats.size
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

async function readCachedRecords(
  cachePath: string,
  operations: WorkspaceFileIndexOperations
): Promise<WorkspaceFileIndexRecord[]> {
  try {
    const raw = await operations.readCache(cachePath);
    const parsed = parseCachedIndex(raw);
    return parsed ?? [];
  } catch {
    return [];
  }
}

async function writeCachedRecords(
  cachePath: string,
  records: WorkspaceFileIndexRecord[],
  operations: WorkspaceFileIndexOperations
): Promise<void> {
  await operations.mkdir(path.dirname(cachePath), { recursive: true });
  await operations.writeCache(
    cachePath,
    `${JSON.stringify({ records, version: workspaceFileIndexCacheVersion }, null, 2)}\n`
  );
}

function parseCachedIndex(raw: string): WorkspaceFileIndexRecord[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

    const index = parsed as PersistedWorkspaceFileIndex;
    if (index.version !== workspaceFileIndexCacheVersion || !Array.isArray(index.records)) return null;

    return index.records.flatMap(parseCachedRecord);
  } catch {
    return null;
  }
}

function parseCachedRecord(raw: unknown): WorkspaceFileIndexRecord[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];

  const record = raw as Record<string, unknown>;
  if (record.kind !== "diagram" && record.kind !== "markdown") return [];
  if (record.readStatus !== "ok" && record.readStatus !== "unreadable") return [];
  if (typeof record.path !== "string" || typeof record.name !== "string") return [];
  if (!isFiniteNumber(record.size) || !isFiniteNumber(record.mtimeMs)) return [];
  if (typeof record.searchable !== "boolean") return [];
  if (!Array.isArray(record.lines) || record.lines.some((line) => typeof line !== "string")) return [];

  return [{
    kind: record.kind,
    lines: record.lines,
    mtimeMs: record.mtimeMs,
    name: record.name,
    path: record.path,
    readStatus: record.readStatus,
    searchable: record.searchable,
    size: record.size
  }];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function readFileHead(filePath: string, byteLength: number): Promise<string> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(byteLength);
    const result = await handle.read(buffer, 0, byteLength, 0);
    return buffer.subarray(0, result.bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}
