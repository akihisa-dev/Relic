import type { WorkspaceTable } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { relicClient, type RelicClient } from "../relicClient";

interface CacheEntry {
  promise: Promise<RelicResult<WorkspaceTable>>;
  status: "pending" | "success";
}

const maximumCachedTables = 2;
const cache = new Map<string, CacheEntry>();
let cacheClient: RelicClient | undefined;

export function loadWorkspaceTable(request: { revision: number; workspaceId: string }): Promise<RelicResult<WorkspaceTable>> {
  const client = currentClient();
  const key = JSON.stringify([request.workspaceId, request.revision]);
  const cached = cache.get(key);
  if (cached) {
    touch(key, cached);
    return cached.promise;
  }

  const entry: CacheEntry = { promise: client.getWorkspaceTable(), status: "pending" };
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
}

export function resetWorkspaceTableCache(): void {
  cache.clear();
  cacheClient = undefined;
}

function currentClient(): RelicClient {
  const client = relicClient.current;
  if (!client) throw new Error("Relic API is unavailable.");
  if (cacheClient !== client) {
    cache.clear();
    cacheClient = client;
  }
  return client;
}

function touch(key: string, entry: CacheEntry): void {
  cache.delete(key);
  cache.set(key, entry);
}

function enforceLimit(): void {
  while (cache.size > maximumCachedTables) {
    const oldest = Array.from(cache.entries()).find(([, entry]) => entry.status === "success")?.[0];
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}
