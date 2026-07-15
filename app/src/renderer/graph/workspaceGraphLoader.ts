import type { WorkspaceGraph } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { relicClient, type RelicClient } from "../relicClient";

export interface WorkspaceGraphRequest {
  revision: number;
  workspaceId: string;
}

interface WorkspaceGraphCacheEntry {
  promise: Promise<RelicResult<WorkspaceGraph>>;
  status: "pending" | "success";
}

// Graph and Sphere share raw workspace data through this small, bounded cache.
// New workspace-derived views should use this API instead of calling
// getWorkspaceGraph() directly or introducing another view-specific cache.
const maximumCachedWorkspaceGraphs = 2;
const cache = new Map<string, WorkspaceGraphCacheEntry>();
let cacheClient: RelicClient | undefined;

function requestKey({ revision, workspaceId }: WorkspaceGraphRequest): string {
  return JSON.stringify([workspaceId, revision]);
}

function useCurrentClient(): RelicClient {
  const client = relicClient.current;
  if (!client) throw new Error("Relic API is unavailable.");
  if (cacheClient !== client) {
    cache.clear();
    cacheClient = client;
  }
  return client;
}

function touch(key: string, entry: WorkspaceGraphCacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
}

function enforceCacheLimit(): void {
  while (cache.size > maximumCachedWorkspaceGraphs) {
    const oldestKey = cache.entries().find(([, entry]) => entry.status === "success")?.[0];
    if (oldestKey === undefined) return;
    cache.delete(oldestKey);
  }
}

export function loadWorkspaceGraph(
  request: WorkspaceGraphRequest
): Promise<RelicResult<WorkspaceGraph>> {
  const client = useCurrentClient();
  const key = requestKey(request);
  const cached = cache.get(key);
  if (cached) {
    touch(key, cached);
    return cached.promise;
  }

  const entry: WorkspaceGraphCacheEntry = {
    promise: client.getWorkspaceGraph(),
    status: "pending"
  };
  touch(key, entry);

  void entry.promise.then(
    (result) => {
      if (cache.get(key) !== entry) return;
      if (!result.ok) {
        cache.delete(key);
        return;
      }
      entry.status = "success";
      enforceCacheLimit();
    },
    () => {
      if (cache.get(key) === entry) cache.delete(key);
    }
  );
  return entry.promise;
}

export function preloadWorkspaceGraph(request: WorkspaceGraphRequest): void {
  try {
    void loadWorkspaceGraph(request).catch(() => undefined);
  } catch {
    // Preloading is best-effort. The visible view reports an unavailable API.
  }
}

export function resetWorkspaceGraphCache(): void {
  cache.clear();
  cacheClient = undefined;
}
