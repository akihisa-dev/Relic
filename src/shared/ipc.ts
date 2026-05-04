import type { RelicResult } from "./result";

export const getAppInfoChannel = "app:getInfo";
export const getWorkspaceStateChannel = "workspace:getState";
export const openWorkspaceChannel = "workspace:open";

export interface AppInfo {
  name: "Relic";
  version: string;
  platform: NodeJS.Platform;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
}

export interface WorkspaceState {
  activeWorkspace: WorkspaceSummary | null;
  fileTree: WorkspaceTreeNode[];
  workspaces: WorkspaceSummary[];
}

export type WorkspaceTreeNode = WorkspaceFolderNode | WorkspaceFileNode;

export interface WorkspaceFolderNode {
  children: WorkspaceTreeNode[];
  name: string;
  path: string;
  type: "folder";
}

export interface WorkspaceFileNode {
  name: string;
  path: string;
  type: "file";
}

export interface RelicApi {
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
}
