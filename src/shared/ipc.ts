import type { RelicResult } from "./result";

export const getAppInfoChannel = "app:getInfo";
export const createFolderChannel = "workspace:createFolder";
export const createMarkdownFileChannel = "workspace:createMarkdownFile";
export const duplicateMarkdownFileChannel = "workspace:duplicateMarkdownFile";
export const getWorkspaceStateChannel = "workspace:getState";
export const moveItemToTrashChannel = "workspace:moveItemToTrash";
export const openWorkspaceChannel = "workspace:open";
export const readMarkdownFileChannel = "workspace:readMarkdownFile";
export const renameMarkdownFileChannel = "workspace:renameMarkdownFile";
export const renameFolderChannel = "workspace:renameFolder";
export const switchWorkspaceChannel = "workspace:switch";
export const writeMarkdownFileChannel = "workspace:writeMarkdownFile";
export const getEditorSettingsChannel = "editor:getSettings";
export const saveEditorSettingsChannel = "editor:saveSettings";

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

export interface DuplicateMarkdownFileInput {
  path: string;
}

export interface RenameMarkdownFileInput {
  newName: string;
  path: string;
}

export interface RenameFolderInput {
  newName: string;
  path: string;
}

export interface MoveItemToTrashInput {
  path: string;
  type: "file" | "folder";
}

export interface SwitchWorkspaceInput {
  workspaceId: string;
}

export interface MarkdownFileContent {
  content: string;
  name: string;
  path: string;
}

export interface WriteMarkdownFileInput {
  content: string;
  path: string;
}

export type EditorFont = "system" | "mincho" | "mono";
export type EditorMaxWidth = "550px" | "660px" | "800px" | "none";

export interface EditorSettings {
  font: EditorFont;
  fontSize: number;
  lineHeight: number;
  maxWidth: EditorMaxWidth;
  showLineNumbers: boolean;
  spellCheck: boolean;
}

export const defaultEditorSettings: EditorSettings = {
  font: "system",
  fontSize: 16,
  lineHeight: 1.7,
  maxWidth: "660px",
  showLineNumbers: false,
  spellCheck: true
};

export interface RenameMarkdownFileResult {
  file: MarkdownFileContent;
  workspaceState: WorkspaceState;
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
  duplicateMarkdownFile: (
    input: DuplicateMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getEditorSettings: () => Promise<RelicResult<EditorSettings>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  moveItemToTrash: (input: MoveItemToTrashInput) => Promise<RelicResult<WorkspaceState>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  readMarkdownFile: (input: ReadMarkdownFileInput) => Promise<RelicResult<MarkdownFileContent>>;
  renameMarkdownFile: (
    input: RenameMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  renameFolder: (input: RenameFolderInput) => Promise<RelicResult<WorkspaceState>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  switchWorkspace: (input: SwitchWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  writeMarkdownFile: (input: WriteMarkdownFileInput) => Promise<RelicResult<void>>;
}
