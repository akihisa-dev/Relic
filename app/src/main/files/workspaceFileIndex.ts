import { createHash } from "node:crypto";
import { open, readFile, stat } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";

import type { WorkspaceFileIndexEntry, WorkspaceFileKind, WorkspaceTreeNode } from "../../shared/ipc";
import { stripMarkdownExtension } from "../../shared/markdownExtension";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { ensurePrivateSettingsDirectory, writePrivateSettingsTextFile } from "../settings/secureSettingsFile";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath } from "./paths";
import { mapWithConcurrency } from "./concurrency";

export interface WorkspaceFileIndex {
  entries: WorkspaceFileIndexEntry[];
  records: WorkspaceFileIndexRecord[];
}

export interface WorkspaceFileIndexRecord extends WorkspaceFileIndexEntry {
  lines: string[];
  searchable: boolean;
  contentHash?: string;
}

interface PersistedWorkspaceFileIndex {
  records?: unknown;
  version?: unknown;
}

interface PersistedWorkspaceFileIndexRecord {
  kind?: unknown;
  mtimeMs?: unknown;
  name?: unknown;
  path?: unknown;
  readStatus?: unknown;
  searchable?: unknown;
  size?: unknown;
  contentHash?: unknown;
}

export interface WorkspaceFileIndexOptions {
  cachePath?: string;
  filePaths?: string[];
  fileTree?: WorkspaceTreeNode[];
  includeSearchContent?: boolean;
  maxSearchFileBytes?: number;
  operations?: Partial<WorkspaceFileIndexOperations>;
}

export interface WorkspaceFileIndexOperations {
  mkdir(directoryPath: string, options: { recursive: true }): Promise<unknown>;
  readCache(filePath: string): Promise<string>;
  readFile(filePath: string): Promise<string>;
  readHead(filePath: string, byteLength: number): Promise<string>;
  stat(filePath: string): Promise<Stats>;
  writeCache(filePath: string, content: string): Promise<void>;
}

const workspaceFileIndexCacheVersion = 4;
const defaultMaxSearchFileBytes = 2 * 1024 * 1024;
const mapMarkerHeadBytes = 256;
const safeWorkspaceIndexIdPattern = /^[A-Za-z0-9_-]+$/;
const maxConcurrentIndexReads = 8;

const defaultOperations: WorkspaceFileIndexOperations = {
  mkdir: (directoryPath) => ensurePrivateSettingsDirectory(directoryPath),
  readCache: (filePath) => readFile(filePath, "utf8"),
  readFile: (filePath) => readFile(filePath, "utf8"),
  readHead: readFileHead,
  stat,
  writeCache: writePrivateSettingsTextFile
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
  const includeSearchContent = options.includeSearchContent ?? true;
  const maxSearchFileBytes = options.maxSearchFileBytes ?? defaultMaxSearchFileBytes;
  const cachedRecords = options.cachePath
    ? await readCachedRecords(options.cachePath, operations)
    : [];
  const cacheByPath = new Map(cachedRecords.map((record) => [record.path, record]));
  const paths = options.filePaths ??
    (options.fileTree !== undefined
      ? collectMarkdownPaths(options.fileTree)
      : collectMarkdownPaths(await readWorkspaceFileTree(workspacePath)));

  const records = await mapWithConcurrency(
    paths,
    maxConcurrentIndexReads,
    async (relativePath) => {
      const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
      if (!absolutePath.ok) return unreadableRecord(relativePath);

      let fileStats: Stats;
      try {
        fileStats = await operations.stat(absolutePath.value);
      } catch {
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
        if (!isWithinCurrentSearchLimit) {
          if (!cached.searchable) {
            try {
              const head = await operations.readHead(absolutePath.value, mapMarkerHeadBytes);
              if (cached.contentHash === fileHash(head)) {
                return { ...cached, lines: [] };
              }
            } catch {
              return unreadableRecord(relativePath, fileStats);
            }
          }

          return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent);
        }

        if (!cached.searchable) {
          return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent);
        }

        if (!includeSearchContent) {
          return { ...cached, lines: [] };
        }

        try {
          const content = await operations.readFile(absolutePath.value);
          const contentHash = fileHash(content);

          if (cached.contentHash === contentHash) {
            return recordFor(relativePath, fileStats, cached.kind, content.split("\n"), cached.searchable, cached.contentHash);
          }
        } catch {
          return unreadableRecord(relativePath, fileStats);
        }
      }

      return readIndexRecord(absolutePath.value, relativePath, fileStats, maxSearchFileBytes, operations, includeSearchContent);
    }
  );

  const sortedRecords = records.sort((a, b) => a.path.localeCompare(b.path, "ja"));

  if (options.cachePath) {
    await writeCachedRecords(options.cachePath, sortedRecords, operations);
  }

  return {
    entries: sortedRecords.map(({ lines: _lines, searchable: _searchable, contentHash: _contentHash, ...entry }) => entry),
    records: sortedRecords
  };
}

async function readIndexRecord(
  absolutePath: string,
  relativePath: string,
  fileStats: Stats,
  maxSearchFileBytes: number,
  operations: WorkspaceFileIndexOperations,
  includeSearchContent: boolean
): Promise<WorkspaceFileIndexRecord> {
  if (fileStats.size > maxSearchFileBytes) {
    try {
      const head = await operations.readHead(absolutePath, mapMarkerHeadBytes);
      return recordFor(
        relativePath,
        fileStats,
        "markdown",
        [],
        false,
        fileHash(head)
      );
    } catch {
      return unreadableRecord(relativePath, fileStats);
    }
  }

  try {
    const content = await operations.readFile(absolutePath);
    return recordFor(
      relativePath,
      fileStats,
      "markdown",
      includeSearchContent ? content.split("\n") : [],
      true,
      fileHash(content)
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
  const persistedRecords = records.map(({ lines: _lines, ...record }) => record);
  await operations.mkdir(path.dirname(cachePath), { recursive: true });
  await operations.writeCache(
    cachePath,
    `${JSON.stringify({ records: persistedRecords, version: workspaceFileIndexCacheVersion }, null, 2)}\n`
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

  const record = raw as PersistedWorkspaceFileIndexRecord;
  if (record.kind !== "diagram" && record.kind !== "markdown") return [];
  if (record.readStatus !== "ok" && record.readStatus !== "unreadable") return [];
  if (typeof record.path !== "string" || typeof record.name !== "string") return [];
  if (!isFiniteNumber(record.size) || !isFiniteNumber(record.mtimeMs)) return [];
  if (typeof record.searchable !== "boolean") return [];
  if (record.readStatus === "ok" && (typeof record.contentHash !== "string" || record.contentHash === "")) return [];

  return [{
    kind: "markdown",
    lines: [],
    mtimeMs: record.mtimeMs,
    name: record.name,
    path: record.path,
    readStatus: record.readStatus,
    searchable: record.searchable,
    size: record.size,
    contentHash: record.readStatus === "ok" ? (record.contentHash as string | undefined) : undefined
  }];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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
