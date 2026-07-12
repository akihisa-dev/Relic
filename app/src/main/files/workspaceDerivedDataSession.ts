import {
  createWorkspaceDerivedDataCache,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataCache,
  type WorkspaceDerivedDataOptions
} from "./workspaceDerivedData";
import type { WorkspaceFileIndex } from "./workspaceFileIndex";

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
  lastUsedAt: number;
  promise: Promise<WorkspaceDerivedDataSnapshot>;
  request: WorkspaceDerivedDataSnapshotRequest;
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

    const key = sessionKeyFor(request);
    const existing = this.entries.get(key);
    const now = this.now();

    if (existing && now - existing.createdAt <= this.ttlMs) {
      existing.lastUsedAt = now;
      return existing.promise;
    }

    const parseCache = createWorkspaceDerivedDataCache();
    const promise = readWorkspaceDerivedFileIndex(request.workspacePath, {
      cachePath: request.cachePath,
      fileIndex: request.fileIndex,
      filePaths: request.filePaths,
      fileTree: request.fileTree,
      maxSearchFileBytes: request.maxSearchFileBytes,
      operations: request.operations,
      parseCache
    }).then((fileIndex) => ({
      fileIndex,
      parseCache
    }));

    this.entries.set(key, {
      createdAt: now,
      lastUsedAt: now,
      promise,
      request: copySnapshotRequest(request),
      workspaceId: request.workspaceId
    });
    this.pruneOverflow();

    return promise;
  }

  invalidate(workspaceId?: string, changedPaths?: string[]): void {
    if (!workspaceId) {
      this.entries.clear();
      return;
    }

    for (const [key, entry] of this.entries.entries()) {
      if (entry.workspaceId !== workspaceId) continue;

      if (!changedPaths || changedPaths.length === 0) {
        this.entries.delete(key);
        continue;
      }

      const relevantPaths = relevantChangedPaths(entry.request, changedPaths);
      if (relevantPaths.length === 0) continue;

      entry.promise = entry.promise.then((snapshot) =>
        refreshSnapshotPaths(snapshot, entry.request, relevantPaths)
      );
      entry.createdAt = this.now();
    }
  }

  size(): number {
    return this.entries.size;
  }

  private pruneExpired(): void {
    const now = this.now();

    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  private pruneOverflow(): void {
    while (this.entries.size > this.maxSessions) {
      const oldest = [...this.entries.entries()]
        .toSorted(([, a], [, b]) => a.lastUsedAt - b.lastUsedAt)[0];

      if (!oldest) return;
      this.entries.delete(oldest[0]);
    }
  }
}

export const workspaceDerivedDataSession = new WorkspaceDerivedDataSession();

export function getWorkspaceDerivedDataSnapshot(
  request: WorkspaceDerivedDataSnapshotRequest
): Promise<WorkspaceDerivedDataSnapshot> {
  return workspaceDerivedDataSession.getSnapshot(request);
}

function sessionKeyFor(request: WorkspaceDerivedDataSnapshotRequest): string {
  return [
    request.workspaceId,
    request.workspacePath,
    request.cachePath ?? "",
    request.maxSearchFileBytes ?? "",
    request.filePaths?.join("\0") ?? ""
  ].join("\0\0");
}

function copySnapshotRequest(
  request: WorkspaceDerivedDataSnapshotRequest
): WorkspaceDerivedDataSnapshotRequest {
  return {
    ...request,
    filePaths: request.filePaths ? [...request.filePaths] : undefined,
    fileTree: request.fileTree ? [...request.fileTree] : undefined
  };
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
  const refreshed = await readWorkspaceDerivedFileIndex(request.workspacePath, {
    filePaths: changedPaths,
    maxSearchFileBytes: request.maxSearchFileBytes,
    operations: request.operations,
    parseCache: snapshot.parseCache
  });
  const changedPathSet = new Set(changedPaths);
  const records = snapshot.fileIndex.records
    .filter((record) => !changedPathSet.has(record.path))
    .concat(refreshed.records)
    .sort((a, b) => a.path.localeCompare(b.path, "ja"));
  snapshot.parseCache.backlinksByTarget = null;

  return {
    fileIndex: {
      entries: records.map(({ lines: _lines, searchable: _searchable, contentHash: _contentHash, ...entry }) => entry),
      records,
      stats: refreshed.stats
    },
    parseCache: snapshot.parseCache
  };
}
