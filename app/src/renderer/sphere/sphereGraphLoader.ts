import type { WorkspaceGraph } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { relicClient } from "../relicClient";

let cachedRequest: {
  key: string;
  promise: Promise<RelicResult<WorkspaceGraph>>;
} | null = null;

export function loadSphereWorkspaceGraph(key: string): Promise<RelicResult<WorkspaceGraph>> {
  if (cachedRequest?.key === key) return cachedRequest.promise;
  const client = relicClient.current;
  if (!client) return Promise.reject(new Error("Relic API is unavailable."));
  const promise = client.getWorkspaceGraph();
  cachedRequest = { key, promise };
  void promise.then(
    (result) => {
      if (!result.ok && cachedRequest?.key === key) cachedRequest = null;
    },
    () => {
      if (cachedRequest?.key === key) cachedRequest = null;
    }
  );
  return promise;
}

export function preloadSphereWorkspaceGraph(key: string): void {
  void loadSphereWorkspaceGraph(key).catch(() => {
    if (cachedRequest?.key === key) cachedRequest = null;
  });
}

export function resetSphereWorkspaceGraphCache(): void {
  cachedRequest = null;
}
