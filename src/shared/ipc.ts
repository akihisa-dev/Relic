import type { RelicResult } from "./result";

export const getAppInfoChannel = "app:getInfo";
export const createFolderChannel = "workspace:createFolder";
export const createMarkdownFileChannel = "workspace:createMarkdownFile";
export const getWorkspaceStateChannel = "workspace:getState";
export const openWorkspaceChannel = "workspace:open";
export const readMarkdownFileChannel = "workspace:readMarkdownFile";

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

export interface CreateMarkdownFileInput {
  name: string;
}

export interface CreateFolderInput {
  name: string;
}

export interface ReadMarkdownFileInput {
  path: string;
}

export interface MarkdownFileContent {
  content: string;
  name: string;
  path: string;
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
  createFolder: (input: CreateFolderInput) => Promise<RelicResult<WorkspaceState>>;
  createMarkdownFile: (input: CreateMarkdownFileInput) => Promise<RelicResult<WorkspaceState>>;
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  readMarkdownFile: (input: ReadMarkdownFileInput) => Promise<RelicResult<MarkdownFileContent>>;
}
