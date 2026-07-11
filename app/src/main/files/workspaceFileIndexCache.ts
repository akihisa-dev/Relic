import path from "node:path";

import type { WorkspaceFileIndexOperations, WorkspaceFileIndexRecord } from "./workspaceFileIndex";

interface PersistedWorkspaceFileIndex {
  records?: unknown;
  version?: unknown;
}

interface PersistedWorkspaceFileIndexRecord {
  lines?: unknown;
  kind?: unknown;
  mtimeMs?: unknown;
  name?: unknown;
  path?: unknown;
  readStatus?: unknown;
  searchable?: unknown;
  size?: unknown;
  contentHash?: unknown;
}

export const workspaceFileIndexCacheVersion = 5;

export async function readCachedWorkspaceFileIndexRecords(
  cachePath: string,
  operations: WorkspaceFileIndexOperations
): Promise<WorkspaceFileIndexRecord[]> {
  try {
    const raw = await operations.readCache(cachePath);
    const parsed = parseCachedWorkspaceFileIndex(raw);
    return parsed ?? [];
  } catch {
    return [];
  }
}

export async function writeCachedWorkspaceFileIndexRecords(
  cachePath: string,
  records: WorkspaceFileIndexRecord[],
  cachedRecordsByPath: Map<string, WorkspaceFileIndexRecord>,
  operations: WorkspaceFileIndexOperations
): Promise<void> {
  const persistedRecords = records.map((record) => ({
    ...record,
    lines: persistedLinesForRecord(record, cachedRecordsByPath.get(record.path))
  }));
  await operations.mkdir(path.dirname(cachePath), { recursive: true });
  await operations.writeCache(
    cachePath,
    `${JSON.stringify({ records: persistedRecords, version: workspaceFileIndexCacheVersion }, null, 2)}\n`
  );
}

function hasUnchangedSearchableRecordMetadata(
  record: WorkspaceFileIndexRecord,
  cached: WorkspaceFileIndexRecord | undefined
): boolean {
  return !!(
    cached &&
    cached.readStatus === "ok" &&
    cached.path === record.path &&
    cached.size === record.size &&
    cached.mtimeMs === record.mtimeMs &&
    cached.contentHash === record.contentHash &&
    cached.searchable === record.searchable
  );
}

function persistedLinesForRecord(
  record: WorkspaceFileIndexRecord,
  cached: WorkspaceFileIndexRecord | undefined
): string[] {
  if (record.readStatus !== "ok" || !record.searchable) return [];
  if (record.lines.length > 0) return record.lines;

  if (hasUnchangedSearchableRecordMetadata(record, cached)) {
    return cached?.lines ?? [];
  }

  return record.lines;
}

export function parseCachedWorkspaceFileIndex(raw: string): WorkspaceFileIndexRecord[] | null {
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
  const lines = Array.isArray(record.lines) && record.lines.every((line) => typeof line === "string")
    ? record.lines
    : [];

  return [{
    kind: "markdown",
    lines,
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
