import {
  cloneWorkspaceDerivedDataCache,
  createWorkspaceDerivedDataCache,
  discardWorkspaceDerivedDataForRecord,
  maxWorkspaceDerivedSearchFileBytes,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataCache,
  type WorkspaceDerivedDataOptions
} from "./workspaceDerivedData";
import type { WorkspaceFileIndex } from "./workspaceFileIndex";
import { bumpWorkspaceFileIndexCacheGeneration } from "./workspaceFileIndexCache";

export interface WorkspaceDerivedDataSnapshot {
  fileIndex: WorkspaceFileIndex;
  parseCache: WorkspaceDerivedDataCache;
}

export interface WorkspaceDerivedDataSnapshotRequest extends WorkspaceDerivedDataOptions {
  workspaceId: string;
  workspacePath: string;
}

interface WorkspaceDerivedDataSessionEntry {
  createdAt: number;
  desiredLimit: number;
  fulfilledLimit: number | null;
  generation: number;
  lastSettledAt: number;
  lastUsedAt: number;
  pending: boolean;
  promise: Promise<WorkspaceDerivedDataSnapshot>;
  request: WorkspaceDerivedDataSnapshotRequest;
  snapshot?: WorkspaceDerivedDataSnapshot;
  upgradePromise?: Promise<WorkspaceDerivedDataSnapshot>;
  workspaceId: string;
}

const defaultSessionTtlMs = 30000;
const defaultMaxSessions = 4;

export class WorkspaceDerivedDataSession {
  private readonly entries = new Map<string, WorkspaceDerivedDataSessionEntry>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs: number = defaultSessionTtlMs,
    private readonly maxSessions: number = defaultMaxSessions
  ) {}

  getSnapshot(request: WorkspaceDerivedDataSnapshotRequest): Promise<WorkspaceDerivedDataSnapshot> {
    this.pruneExpired();

    const normalizedRequest = normalizeSnapshotRequest(request);
    const key = sessionKeyFor(normalizedRequest);
    const existing = this.entries.get(key);
    const now = this.now();

    if (existing) {
      existing.lastUsedAt = now;
      const requestedLimit = normalizedLimit(normalizedRequest);
      const previousDesiredLimit = existing.desiredLimit;
      existing.request = mergeSnapshotRequest(existing.request, normalizedRequest);
      existing.desiredLimit = Math.max(existing.desiredLimit, requestedLimit);

      if (existing.snapshot && (existing.fulfilledLimit ?? -Infinity) >= requestedLimit) {
        return existing.promise;
      }
      if (existing.upgradePromise) return existing.upgradePromise;
      if (!existing.snapshot && requestedLimit <= previousDesiredLimit) {
        return existing.promise;
      }
      return this.startUpgrade(key, existing);
    }

    const parseCache = createWorkspaceDerivedDataCache();
    const generation = 0;
    const entry = {} as WorkspaceDerivedDataSessionEntry;
    const promise = readWorkspaceDerivedFileIndex(normalizedRequest.workspacePath, {
      cacheGeneration: normalizedRequest.cacheGeneration,
      cacheOwnerPath: normalizedRequest.cacheOwnerPath ?? normalizedRequest.workspacePath,
      cachePath: normalizedRequest.cachePath,
      completeSnapshot: normalizedRequest.completeSnapshot,
      fileIndex: normalizedRequest.fileIndex,
      filePaths: normalizedRequest.filePaths,
      fileTree: normalizedRequest.fileTree,
      maxSearchFileBytes: normalizedLimit(normalizedRequest),
      operations: normalizedRequest.operations,
      parseCache
    }).then((fileIndex) => {
      if (!this.isCurrentEntry(key, entry, generation)) {
        throw new WorkspaceDerivedDataStaleError();
      }
      const snapshot = { fileIndex, parseCache };
      entry.snapshot = snapshot;
      entry.fulfilledLimit = normalizedLimit(normalizedRequest);
      entry.lastSettledAt = this.now();
      entry.pending = false;
      return snapshot;
    });

    Object.assign(entry, {
      createdAt: now,
      desiredLimit: normalizedLimit(normalizedRequest),
      fulfilledLimit: null,
      generation,
      lastSettledAt: now,
      lastUsedAt: now,
      pending: true,
      promise,
      request: normalizedRequest,
      workspaceId: normalizedRequest.workspaceId
    });
    this.entries.set(key, entry);
    this.trackInitialPromiseFailure(key, entry, promise);
    this.pruneOverflow();

    return promise;
  }

  invalidate(workspaceId?: string, changedPaths?: string[]): void {
    if (!workspaceId) {
      for (const entry of this.entries.values()) {
        entry.generation += 1;
        this.bumpCacheGeneration(entry);
      }
      this.entries.clear();
      return;
    }

    for (const [key, entry] of this.entries.entries()) {
      if (entry.workspaceId !== workspaceId) continue;

      if (!changedPaths || changedPaths.length === 0) {
        entry.generation += 1;
        this.bumpCacheGeneration(entry);
        this.entries.delete(key);
        continue;
      }

      const relevantPaths = relevantChangedPaths(entry.request, changedPaths);
      if (relevantPaths.length === 0) continue;

      entry.generation += 1;
      this.bumpCacheGeneration(entry);
      const generation = entry.generation;
      const basePromise = entry.upgradePromise ?? entry.promise;
      const refreshParseCache = entry.snapshot?.parseCache ?? createWorkspaceDerivedDataCache();
      const refreshPromise = entry.snapshot
        ? basePromise.then((snapshot) => {
          if (!this.isCurrentEntry(key, entry, generation)) {
            throw new WorkspaceDerivedDataStaleError();
          }
          return refreshSnapshotPaths(snapshot, entry.request, relevantPaths);
        })
          .then((snapshot) => {
            entry.snapshot = snapshot;
            entry.lastSettledAt = this.now();
            entry.pending = false;
            return snapshot;
          })
        : readWorkspaceDerivedFileIndex(entry.request.workspacePath, {
          cacheGeneration: entry.request.cacheGeneration,
          cacheOwnerPath: entry.request.cacheOwnerPath ?? entry.request.workspacePath,
          cachePath: entry.request.cachePath,
          completeSnapshot: entry.request.completeSnapshot,
          fileIndex: entry.request.fileIndex,
          filePaths: entry.request.filePaths,
          fileTree: entry.request.fileTree,
          forceReadPaths: relevantPaths,
          maxSearchFileBytes: normalizedLimit(entry.request),
          operations: entry.request.operations,
          parseCache: refreshParseCache
        }).then((fileIndex) => {
          if (!this.isCurrentEntry(key, entry, generation)) {
            throw new WorkspaceDerivedDataStaleError();
          }
          const snapshot = { fileIndex, parseCache: refreshParseCache };
          entry.snapshot = snapshot;
          entry.lastSettledAt = this.now();
          entry.pending = false;
          return snapshot;
        });
      entry.promise = refreshPromise;
      entry.upgradePromise = undefined;
      entry.pending = true;
      this.trackRefreshPromiseFailure(key, entry, refreshPromise);
    }
  }

  size(): number {
    return this.entries.size;
  }

  private bumpCacheGeneration(entry: WorkspaceDerivedDataSessionEntry): void {
    if (!entry.request.cachePath) return;
    const generation = bumpWorkspaceFileIndexCacheGeneration(entry.request.cachePath);
    entry.request.cacheGeneration = generation;
  }

  private startUpgrade(
    key: string,
    entry: WorkspaceDerivedDataSessionEntry
  ): Promise<WorkspaceDerivedDataSnapshot> {
    const generation = entry.generation;
    const basePromise = entry.snapshot ? Promise.resolve(entry.snapshot) : entry.promise;
    const upgradePromise = basePromise.then(async () => {
      while ((entry.fulfilledLimit ?? -Infinity) < entry.desiredLimit) {
        if (!this.isCurrentEntry(key, entry, generation)) {
          throw new WorkspaceDerivedDataStaleError();
        }

        const targetLimit = entry.desiredLimit;
        const current = entry.snapshot;
        if (!current) throw new Error("Workspace derived snapshot is unavailable.");

        const fileIndex = await readWorkspaceDerivedFileIndex(entry.request.workspacePath, {
          cacheGeneration: entry.request.cacheGeneration,
          cacheOwnerPath: entry.request.cacheOwnerPath ?? entry.request.workspacePath,
          cachePath: entry.request.cachePath,
          completeSnapshot: entry.request.completeSnapshot,
          fileIndex: current.fileIndex,
          filePaths: entry.request.filePaths,
          fileTree: entry.request.fileTree,
          maxSearchFileBytes: targetLimit,
          operations: entry.request.operations,
          parseCache: current.parseCache
        });
        if (!this.isCurrentEntry(key, entry, generation)) {
          throw new WorkspaceDerivedDataStaleError();
        }
        entry.snapshot = { fileIndex, parseCache: current.parseCache };
        entry.fulfilledLimit = targetLimit;
        entry.lastSettledAt = this.now();
      }

      if (!entry.snapshot) throw new Error("Workspace derived snapshot is unavailable.");
      return entry.snapshot;
    });

    entry.upgradePromise = upgradePromise;
    entry.promise = upgradePromise;
    entry.pending = true;
    upgradePromise.then(
      (snapshot) => {
        if (!this.isCurrentEntry(key, entry, generation)) return;
        entry.snapshot = snapshot;
        entry.upgradePromise = undefined;
        entry.promise = Promise.resolve(snapshot);
        entry.pending = false;
        entry.lastSettledAt = this.now();
      },
      () => {
        if (!this.isCurrentEntry(key, entry, generation)) return;
        entry.upgradePromise = undefined;
        entry.pending = false;
        if (entry.snapshot) {
          entry.promise = Promise.resolve(entry.snapshot);
        }
      }
    );
    this.trackUpgradePromiseFailure(key, entry, upgradePromise);
    return upgradePromise;
  }

  private isCurrentEntry(
    key: string,
    entry: WorkspaceDerivedDataSessionEntry,
    generation: number
  ): boolean {
    return this.entries.get(key) === entry && entry.generation === generation;
  }

  private pruneExpired(): void {
    const now = this.now();

    for (const [key, entry] of this.entries.entries()) {
      if (entry.pending) continue;
      if (now - entry.lastUsedAt > this.ttlMs) {
        entry.generation += 1;
        this.entries.delete(key);
      }
    }
  }

  private pruneOverflow(): void {
    while (this.entries.size > this.maxSessions) {
      const candidates = [...this.entries.entries()]
        .filter(([, entry]) => !entry.pending)
        .toSorted(([, a], [, b]) => a.lastUsedAt - b.lastUsedAt);
      const oldest = candidates[0];

      if (!oldest) return;
      oldest[1].generation += 1;
      this.entries.delete(oldest[0]);
    }
  }

  private trackInitialPromiseFailure(
    key: string,
    entry: WorkspaceDerivedDataSessionEntry,
    promise: Promise<WorkspaceDerivedDataSnapshot>
  ): void {
    promise.catch(() => {
      const current = this.entries.get(key);
      if (current === entry && current.promise === promise) {
        current.generation += 1;
        this.entries.delete(key);
      }
    });
  }

  private trackUpgradePromiseFailure(
    key: string,
    entry: WorkspaceDerivedDataSessionEntry,
    promise: Promise<WorkspaceDerivedDataSnapshot>
  ): void {
    promise.catch(() => {
      const current = this.entries.get(key);
      if (current !== entry || current.upgradePromise !== promise) return;
      current.upgradePromise = undefined;
      current.pending = false;
      if (!current.snapshot) {
        current.generation += 1;
        this.entries.delete(key);
      } else {
        current.promise = Promise.resolve(current.snapshot);
      }
    });
  }

  private trackRefreshPromiseFailure(
    key: string,
    entry: WorkspaceDerivedDataSessionEntry,
    promise: Promise<WorkspaceDerivedDataSnapshot>
  ): void {
    promise.catch(() => {
      const current = this.entries.get(key);
      if (current === entry && current.promise === promise) {
        current.generation += 1;
        this.entries.delete(key);
      }
    });
  }
}

export const workspaceDerivedDataSession = new WorkspaceDerivedDataSession();

export function getWorkspaceDerivedDataSnapshot(
  request: WorkspaceDerivedDataSnapshotRequest
): Promise<WorkspaceDerivedDataSnapshot> {
  return workspaceDerivedDataSession.getSnapshot(request);
}

function normalizeSnapshotRequest(
  request: WorkspaceDerivedDataSnapshotRequest
): WorkspaceDerivedDataSnapshotRequest {
  return {
    ...request,
    filePaths: request.filePaths ? [...new Set(request.filePaths)].sort() : undefined,
    fileTree: request.fileTree ? [...request.fileTree] : undefined,
    maxSearchFileBytes: normalizedLimit(request)
  };
}

function mergeSnapshotRequest(
  current: WorkspaceDerivedDataSnapshotRequest,
  next: WorkspaceDerivedDataSnapshotRequest
): WorkspaceDerivedDataSnapshotRequest {
  return {
    ...current,
    ...next,
    fileIndex: current.fileIndex ?? next.fileIndex,
    filePaths: current.filePaths ?? next.filePaths,
    fileTree: current.fileTree ?? next.fileTree,
    operations: next.operations ?? current.operations,
    maxSearchFileBytes: Math.max(normalizedLimit(current), normalizedLimit(next))
  };
}

function normalizedLimit(request: WorkspaceDerivedDataSnapshotRequest): number {
  const requested = request.maxSearchFileBytes;
  if (requested === undefined) return maxWorkspaceDerivedSearchFileBytes;
  if (!Number.isFinite(requested) || requested < 0) return 0;
  return Math.min(Math.floor(requested), maxWorkspaceDerivedSearchFileBytes);
}

function sessionKeyFor(request: WorkspaceDerivedDataSnapshotRequest): string {
  return [
    request.workspaceId,
    request.workspacePath,
    request.cachePath ?? "",
    request.filePaths?.join("\0") ?? ""
  ].join("\0\0");
}

function relevantChangedPaths(
  request: WorkspaceDerivedDataSnapshotRequest,
  changedPaths: string[]
): string[] {
  const requestedPathSet = request.filePaths ? new Set(request.filePaths) : null;
  return [...new Set(changedPaths)].filter((changedPath) =>
    changedPath.length > 0 && (!requestedPathSet || requestedPathSet.has(changedPath))
  );
}

async function refreshSnapshotPaths(
  snapshot: WorkspaceDerivedDataSnapshot,
  request: WorkspaceDerivedDataSnapshotRequest,
  changedPaths: string[]
): Promise<WorkspaceDerivedDataSnapshot> {
  const parseCache = cloneWorkspaceDerivedDataCache(snapshot.parseCache);
  const changedPathSet = new Set(changedPaths);
  for (const record of snapshot.fileIndex.records) {
    if (changedPathSet.has(record.path)) {
      discardWorkspaceDerivedDataForRecord(parseCache, record);
    }
  }
  // A newly added path has no old record key, but still changes the aggregate.
  parseCache.backlinksByTarget = null;

  const refreshed = await readWorkspaceDerivedFileIndex(request.workspacePath, {
    cacheGeneration: request.cacheGeneration,
    cacheOwnerPath: request.cacheOwnerPath ?? request.workspacePath,
    cachePath: request.cachePath,
    completeSnapshot: false,
    filePaths: changedPaths,
    forceReadPaths: changedPaths,
    maxSearchFileBytes: normalizedLimit(request),
    operations: request.operations,
    parseCache
  });
  const records = snapshot.fileIndex.records
    .filter((record) => !changedPathSet.has(record.path))
    .concat(refreshed.records)
    .sort((a, b) => a.path.localeCompare(b.path, "ja"));
  return {
    fileIndex: {
      entries: records.map(({
        contentHash: _contentHash,
        headHash: _headHash,
        lines: _lines,
        searchable: _searchable,
        ...entry
      }) => entry),
      records,
      stats: refreshed.stats
    },
    parseCache
  };
}

class WorkspaceDerivedDataStaleError extends Error {
  constructor() {
    super("Workspace derived data generation is stale.");
    this.name = "WorkspaceDerivedDataStaleError";
  }
}
