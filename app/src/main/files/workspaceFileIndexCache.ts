import path from "node:path";

import {
  defaultWorkspaceFileIndexOperations,
  type WorkspaceFileIndexOperations
} from "./workspaceFileIndexIO";
import {
  maxWorkspaceFileIndexAggregateLineBytes,
  maxWorkspaceFileIndexLinesPerRecord,
  maxWorkspaceFileIndexRecords,
  type WorkspaceFileIndexRecord
} from "./workspaceFileIndexTypes";

interface PersistedWorkspaceFileIndex {
  generation?: unknown;
  ownerPath?: unknown;
  records?: unknown;
  version?: unknown;
}

interface PersistedWorkspaceFileIndexRecord {
  contentHash?: unknown;
  dev?: unknown;
  headHash?: unknown;
  ino?: unknown;
  lines?: unknown;
  kind?: unknown;
  mtimeMs?: unknown;
  name?: unknown;
  path?: unknown;
  readStatus?: unknown;
  realPath?: unknown;
  searchable?: unknown;
  size?: unknown;
}

interface WorkspaceFileIndexCacheSnapshot {
  generation: number;
  ownerPath?: string;
  records: WorkspaceFileIndexRecord[];
}

export interface WorkspaceFileIndexCacheWriteOptions {
  completeSnapshot?: boolean;
  generation?: number;
  ownerPath?: string;
}

export interface WorkspaceFileIndexCacheReadOptions {
  expectedOwnerPath: string;
  minimumGeneration?: number;
}

export interface WorkspaceFileIndexCacheReadResult {
  generation: number;
  records: WorkspaceFileIndexRecord[];
}

interface WorkspaceFileIndexCacheRuntimeState {
  generation: number;
  ownerPath?: string;
}

export const workspaceFileIndexCacheVersion = 7;

const cacheWriteQueues = new Map<string, Promise<void>>();
const cacheRuntimeStates = new Map<string, WorkspaceFileIndexCacheRuntimeState>();

export function getWorkspaceFileIndexCacheGeneration(cachePath: string): number {
  return cacheRuntimeStates.get(cachePath)?.generation ?? 0;
}

export function bumpWorkspaceFileIndexCacheGeneration(cachePath: string): number {
  const current = cacheRuntimeStates.get(cachePath);
  const next = (current?.generation ?? 0) + 1;
  cacheRuntimeStates.set(cachePath, { generation: next, ownerPath: current?.ownerPath });
  return next;
}

export async function transitionWorkspaceFileIndexCacheOwner(
  cachePath: string,
  ownerPath: string,
  operations: WorkspaceFileIndexOperations = defaultWorkspaceFileIndexOperations
): Promise<number> {
  await cacheWriteQueues.get(cachePath)?.catch(() => undefined);
  const snapshot = await readCacheSnapshot(cachePath, operations);
  const current = cacheRuntimeStates.get(cachePath);
  const generation = Math.max(
    current?.generation ?? 0,
    snapshot?.generation ?? 0
  ) + 1;
  cacheRuntimeStates.set(cachePath, { generation, ownerPath });
  return generation;
}

export async function readCachedWorkspaceFileIndexRecords(
  cachePath: string,
  operations: WorkspaceFileIndexOperations,
  options: WorkspaceFileIndexCacheReadOptions
): Promise<WorkspaceFileIndexCacheReadResult> {
  const snapshot = await readCacheSnapshot(cachePath, operations);
  const current = cacheRuntimeStates.get(cachePath);
  const persistedGeneration = snapshot?.generation ?? 0;
  const minimumGeneration = options.minimumGeneration ?? 0;

  if (current?.ownerPath && current.ownerPath !== options.expectedOwnerPath) {
    return { generation: current.generation, records: [] };
  }

  const ownerMatches = snapshot?.ownerPath === options.expectedOwnerPath;
  const generation = Math.max(
    current?.generation ?? 0,
    persistedGeneration,
    minimumGeneration
  ) + (!current?.ownerPath && snapshot !== null && !ownerMatches ? 1 : 0);
  cacheRuntimeStates.set(cachePath, {
    generation,
    ownerPath: options.expectedOwnerPath
  });
  return {
    generation,
    records: ownerMatches ? snapshot.records : []
  };
}

export async function writeCachedWorkspaceFileIndexRecords(
  cachePath: string,
  records: WorkspaceFileIndexRecord[],
  cachedRecordsByPath: Map<string, WorkspaceFileIndexRecord>,
  operations: WorkspaceFileIndexOperations,
  options: WorkspaceFileIndexCacheWriteOptions = {}
): Promise<void> {
  const previous = cacheWriteQueues.get(cachePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => writeCacheSnapshot(cachePath, records, cachedRecordsByPath, operations, options));
  cacheWriteQueues.set(cachePath, next);
  try {
    await next;
  } finally {
    if (cacheWriteQueues.get(cachePath) === next) cacheWriteQueues.delete(cachePath);
  }
}

async function writeCacheSnapshot(
  cachePath: string,
  records: WorkspaceFileIndexRecord[],
  cachedRecordsByPath: Map<string, WorkspaceFileIndexRecord>,
  operations: WorkspaceFileIndexOperations,
  options: WorkspaceFileIndexCacheWriteOptions
): Promise<void> {
  const existing = await readCacheSnapshot(cachePath, operations);
  const incomingGeneration = options.generation ?? 0;
  const existingGeneration = existing?.generation ?? 0;
  const incomingOwnerPath = options.ownerPath;
  const runtimeState = cacheRuntimeStates.get(cachePath);
  const ownerChanged = !!(
    existing?.ownerPath &&
    incomingOwnerPath &&
    existing.ownerPath !== incomingOwnerPath
  );

  if (incomingGeneration < (runtimeState?.generation ?? 0)) return;
  if (runtimeState?.ownerPath && incomingOwnerPath !== runtimeState.ownerPath) return;
  if (incomingGeneration < existingGeneration) return;
  if (ownerChanged && incomingGeneration === existingGeneration) return;
  // A partial result cannot establish ownership for a different workspace
  // path. Require the relink prime to publish a complete snapshot first.
  if (ownerChanged && options.completeSnapshot !== true) return;

  cacheRuntimeStates.set(cachePath, {
    generation: incomingGeneration,
    ownerPath: incomingOwnerPath ?? runtimeState?.ownerPath ?? existing?.ownerPath
  });

  const replaceRecords = ownerChanged && options.completeSnapshot === true;
  const currentRecords = replaceRecords ? [] : (existing?.records ?? []);
  const previousByPath = new Map(currentRecords.map((record) => [record.path, record]));
  const mergedByPath = new Map(currentRecords.map((record) => [record.path, record]));

  for (const record of records) {
    const cached = mergedByPath.get(record.path) ?? cachedRecordsByPath.get(record.path);
    mergedByPath.set(record.path, mergeRecords(cached, record));
  }

  if (options.completeSnapshot && !replaceRecords) {
    const incomingPaths = new Set(records.map((record) => record.path));
    for (const recordPath of mergedByPath.keys()) {
      if (!incomingPaths.has(recordPath)) mergedByPath.delete(recordPath);
    }
  }

  const sortedRecords = [...mergedByPath.values()].sort((a, b) => a.path.localeCompare(b.path, "ja"));
  const persistedRecords = sortedRecords.map((record) => ({
    ...record,
    lines: persistedLinesForRecord(record, previousByPath.get(record.path) ?? cachedRecordsByPath.get(record.path))
  }));
  await operations.mkdir(path.dirname(cachePath), { recursive: true });
  await operations.writeCache(
    cachePath,
    `${JSON.stringify({
      generation: Math.max(existingGeneration, incomingGeneration),
      ownerPath: incomingOwnerPath ?? existing?.ownerPath,
      records: persistedRecords,
      version: workspaceFileIndexCacheVersion
    }, null, 2)}\n`
  );
}

function mergeRecords(
  existing: WorkspaceFileIndexRecord | undefined,
  incoming: WorkspaceFileIndexRecord
): WorkspaceFileIndexRecord {
  if (!existing) return incoming;
  if (!sameRecordIdentity(existing, incoming)) return incoming;

  return completenessRank(incoming) >= completenessRank(existing) ? incoming : existing;
}

function sameRecordIdentity(
  first: WorkspaceFileIndexRecord,
  second: WorkspaceFileIndexRecord
): boolean {
  if (
    first.path !== second.path ||
    first.size !== second.size ||
    first.mtimeMs !== second.mtimeMs ||
    first.readStatus !== second.readStatus ||
    first.dev !== second.dev ||
    first.ino !== second.ino ||
    first.realPath !== second.realPath
  ) return false;
  if (first.headHash && second.headHash) return first.headHash === second.headHash;
  return first.contentHash === second.contentHash;
}

function completenessRank(record: WorkspaceFileIndexRecord): number {
  if (record.readStatus !== "ok") return 0;
  if (!record.searchable) return 1;
  return record.lines.length > 0 ? 3 : 2;
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
    cached.dev === record.dev &&
    cached.ino === record.ino &&
    cached.realPath === record.realPath &&
    cached.contentHash === record.contentHash &&
    cached.headHash === record.headHash &&
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
  return parseCachedWorkspaceFileIndexSnapshot(raw)?.records ?? null;
}

function parseCachedWorkspaceFileIndexSnapshot(raw: string): WorkspaceFileIndexCacheSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

    const index = parsed as PersistedWorkspaceFileIndex;
    if (index.version !== workspaceFileIndexCacheVersion || !Array.isArray(index.records)) return null;
    const generation = isSafeNonNegativeInteger(index.generation) ? index.generation : 0;
    const ownerPath = typeof index.ownerPath === "string" ? index.ownerPath : undefined;

    const records: WorkspaceFileIndexRecord[] = [];
    let aggregateLineBytes = 0;
    for (const rawRecord of index.records.slice(0, maxWorkspaceFileIndexRecords)) {
      const parsedRecord = parseCachedRecord(rawRecord);
      if (!parsedRecord) continue;
      const lineBytes = parsedRecord.lines.reduce((total, line) => total + Buffer.byteLength(line, "utf8"), 0);
      if (
        parsedRecord.lines.length > maxWorkspaceFileIndexLinesPerRecord ||
        !Number.isSafeInteger(lineBytes) ||
        aggregateLineBytes + lineBytes > maxWorkspaceFileIndexAggregateLineBytes
      ) continue;
      aggregateLineBytes += lineBytes;
      records.push(parsedRecord);
    }

    return {
      generation,
      ownerPath,
      records
    };
  } catch {
    return null;
  }
}

async function readCacheSnapshot(
  cachePath: string,
  operations: WorkspaceFileIndexOperations
): Promise<WorkspaceFileIndexCacheSnapshot | null> {
  try {
    return parseCachedWorkspaceFileIndexSnapshot(await operations.readCache(cachePath));
  } catch {
    return null;
  }
}

function parseCachedRecord(raw: unknown): WorkspaceFileIndexRecord | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

  const record = raw as PersistedWorkspaceFileIndexRecord;
  if (record.kind !== "markdown") return null;
  if (record.readStatus !== "ok" && record.readStatus !== "unreadable") return null;
  if (typeof record.path !== "string" || !isSafeRelativePath(record.path) || typeof record.name !== "string") return null;
  if (!isSafeNonNegativeInteger(record.size) || !isFiniteNumber(record.mtimeMs) || record.mtimeMs < 0) return null;
  if (typeof record.searchable !== "boolean") return null;
  if (record.readStatus === "ok" && (typeof record.contentHash !== "string" || record.contentHash === "")) return null;
  const lines = Array.isArray(record.lines) && record.lines.every((line) => typeof line === "string")
    ? record.lines
    : [];
  const headHash = typeof record.headHash === "string" && record.headHash !== ""
    ? record.headHash
    : (!record.searchable && typeof record.contentHash === "string" ? record.contentHash : undefined);

  return {
    kind: record.kind,
    dev: isSafeNonNegativeInteger(record.dev) ? record.dev : undefined,
    ino: isSafeNonNegativeInteger(record.ino) ? record.ino : undefined,
    lines,
    mtimeMs: record.mtimeMs,
    name: record.name,
    path: record.path,
    readStatus: record.readStatus,
    searchable: record.searchable,
    size: record.size,
    realPath: typeof record.realPath === "string" && record.realPath !== ""
      ? record.realPath
      : undefined,
    contentHash: record.readStatus === "ok" ? (record.contentHash as string | undefined) : undefined,
    headHash
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\0") || value.startsWith("/") || value.includes("\\")) return false;
  const parts = value.split("/");
  return parts.every((part) => part !== "" && part !== "." && part !== "..");
}
