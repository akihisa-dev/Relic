import type { WorkspaceDerivedDataOptions } from "./workspaceDerivedData";
import {
  getWorkspaceDerivedDataSnapshot,
  type WorkspaceDerivedDataSnapshot,
  type WorkspaceDerivedDataSnapshotRequest
} from "./workspaceDerivedDataSession";
import { getWorkspaceFileIndexCachePath } from "./workspaceFileIndex";

export interface WorkspaceDataRequest {
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
  getCachePath: (userDataPath: string, workspaceId: string) => string;
  getSnapshot: (request: WorkspaceDerivedDataSnapshotRequest) => Promise<WorkspaceDerivedDataSnapshot>;
}

export class WorkspaceDataProvider {
  constructor(private readonly operations: WorkspaceDataProviderOperations) {}

  async get(request: WorkspaceDataRequest): Promise<WorkspaceDataAccess> {
    const cachePath = this.operations.getCachePath(request.userDataPath, request.workspaceId);
    const snapshot = await this.operations.getSnapshot({
      cachePath,
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
  getCachePath: getWorkspaceFileIndexCachePath,
  getSnapshot: getWorkspaceDerivedDataSnapshot
});
