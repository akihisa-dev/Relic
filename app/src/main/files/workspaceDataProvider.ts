import type { WorkspaceTreeNode } from "../../shared/ipc";
import type { WorkspaceDerivedDataOptions } from "./workspaceDerivedData";
import {
  getWorkspaceDerivedDataSnapshot,
  type WorkspaceDerivedDataSnapshot,
  type WorkspaceDerivedDataSnapshotRequest
} from "./workspaceDerivedDataSession";
import {
  getWorkspaceFileIndexCacheGeneration
} from "./workspaceFileIndexCache";
import { getWorkspaceFileIndexCachePath as getCachePath } from "./workspaceFileIndex";

export interface WorkspaceDataRequest {
  fileTree?: WorkspaceTreeNode[];
  maxSearchFileBytes?: number;
  userDataPath: string;
  workspaceId: string;
  workspacePath: string;
}

export interface WorkspaceDataAccess {
  options: Pick<WorkspaceDerivedDataOptions, "cachePath" | "fileIndex" | "parseCache">;
  workspacePath: string;
}

export interface WorkspaceDataProviderOperations {
  getCacheGeneration?: (cachePath: string) => number;
  getCachePath: (userDataPath: string, workspaceId: string) => string;
  getSnapshot: (request: WorkspaceDerivedDataSnapshotRequest) => Promise<WorkspaceDerivedDataSnapshot>;
}

export class WorkspaceDataProvider {
  constructor(private readonly operations: WorkspaceDataProviderOperations) {}

  async get(request: WorkspaceDataRequest): Promise<WorkspaceDataAccess> {
    const cachePath = this.operations.getCachePath(request.userDataPath, request.workspaceId);
    const cacheGeneration = this.operations.getCacheGeneration?.(cachePath) ??
      getWorkspaceFileIndexCacheGeneration(cachePath);
    const snapshot = await this.operations.getSnapshot({
      cacheGeneration,
      cacheOwnerPath: request.workspacePath,
      cachePath,
      fileTree: request.fileTree,
      maxSearchFileBytes: request.maxSearchFileBytes,
      workspaceId: request.workspaceId,
      workspacePath: request.workspacePath
    });

    return {
      options: {
        cachePath,
        fileIndex: snapshot.fileIndex,
        parseCache: snapshot.parseCache
      },
      workspacePath: request.workspacePath
    };
  }
}

export const workspaceDataProvider = new WorkspaceDataProvider({
  getCacheGeneration: getWorkspaceFileIndexCacheGeneration,
  getCachePath,
  getSnapshot: getWorkspaceDerivedDataSnapshot
});
