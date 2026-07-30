import type { RelicResult } from "../shared/result";
import { relicClient, type RelicClient } from "./relicClient";

export interface WorkspaceResourceRequest {
  revision: number;
  workspaceId: string;
}

interface WorkspaceResourceCacheEntry<T> {
  promise: Promise<RelicResult<T>>;
  status: "pending" | "success";
}

export interface WorkspaceResourceLoader<T> {
  load: (request: WorkspaceResourceRequest) => Promise<RelicResult<T>>;
  preload: (request: WorkspaceResourceRequest) => void;
  reset: () => void;
}

export function createWorkspaceResourceLoader<T>(
  loadFromClient: (client: RelicClient) => Promise<RelicResult<T>>,
  maximumCachedResources = 2
): WorkspaceResourceLoader<T> {
  const cache = new Map<string, WorkspaceResourceCacheEntry<T>>();
  let cacheClient: RelicClient | undefined;

  const reset = (): void => {
    cache.clear();
    cacheClient = undefined;
  };

  const load = (request: WorkspaceResourceRequest): Promise<RelicResult<T>> => {
    const client = currentClient();
    const key = JSON.stringify([request.workspaceId, request.revision]);
    const cached = cache.get(key);
    if (cached) {
      touch(key, cached);
      return cached.promise;
    }

    const entry: WorkspaceResourceCacheEntry<T> = {
      promise: loadFromClient(client),
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
        enforceLimit();
      },
      () => {
        if (cache.get(key) === entry) cache.delete(key);
      }
    );
    return entry.promise;
  };

  const preload = (request: WorkspaceResourceRequest): void => {
    try {
      void load(request).catch(() => undefined);
    } catch {
      // Preloading is best-effort. The visible view reports an unavailable API.
    }
  };

  function currentClient(): RelicClient {
    const client = relicClient.current;
    if (!client) throw new Error("Relic API is unavailable.");
    if (cacheClient !== client) {
      cache.clear();
      cacheClient = client;
    }
    return client;
  }

  function touch(key: string, entry: WorkspaceResourceCacheEntry<T>): void {
    cache.delete(key);
    cache.set(key, entry);
  }

  function enforceLimit(): void {
    while (cache.size > maximumCachedResources) {
      const oldest = Array.from(cache.entries()).find(([, entry]) => entry.status === "success")?.[0];
      if (oldest === undefined) return;
      cache.delete(oldest);
    }
  }

  return { load, preload, reset };
}
