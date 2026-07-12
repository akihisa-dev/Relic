import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";
import type { WorkspaceState } from "./workspace";

export const createFolderChannel = "workspace:createFolder";
export const importMarkdownFilesChannel = "workspace:importMarkdownFiles";
export const importImageFileChannel = "workspace:importImageFile";
export const readImageFileChannel = "workspace:readImageFile";
export const readPdfFileChannel = "workspace:readPdfFile";
export const createLinkedMarkdownFileChannel = "workspace:createLinkedMarkdownFile";
export const createMarkdownFileChannel = "workspace:createMarkdownFile";
export const duplicateMarkdownFileChannel = "workspace:duplicateMarkdownFile";
export const getLinkUpdateImpactChannel = "workspace:getLinkUpdateImpact";
export const moveItemToTrashChannel = "workspace:moveItemToTrash";
export const readMarkdownFileChannel = "workspace:readMarkdownFile";
export const renameMarkdownFileChannel = "workspace:renameMarkdownFile";
export const renameFolderChannel = "workspace:renameFolder";
export const revealWorkspaceItemChannel = "workspace:revealItem";
export const startWorkspaceFileDragChannel = "workspace:startFileDrag";
export const moveMarkdownFileChannel = "workspace:moveMarkdownFile";
export const moveFolderChannel = "workspace:moveFolder";

export const maxWorkspaceRelativePathLength = 1024;
export const maxImportMarkdownFiles = 500;

export interface CreateMarkdownFileInput {
  name: string;
}

export interface ImportMarkdownFilesInput {
  destinationFolder: string;
  sourcePaths: string[];
}

export interface ImportImageFileInput {
  destinationFolder: string;
  sourcePath: string;
}

export interface ImportImageFileResult {
  path: string;
}

export interface ReadImageFileInput {
  path: string;
}

export interface ReadImageFileResult {
  dataUrl: string;
}

export interface ReadPdfFileInput {
  path: string;
}

export interface ReadPdfFileResult {
  dataUrl: string;
}

export interface CreateLinkedMarkdownFileInput {
  path: string;
}

export interface CreateFolderInput {
  name: string;
  parentFolder?: string;
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

export interface RevealWorkspaceItemInput {
  path: string;
  workspaceId?: string;
}

export interface StartWorkspaceFileDragInput {
  paths: string[];
}

export interface MoveMarkdownFileInput {
  destinationFolder: string;
  path: string;
}

export interface MoveFolderInput {
  destinationFolder: string;
  path: string;
}

export type LinkUpdateImpactKind = "file" | "folder";

export interface LinkUpdateImpactInput {
  kind: LinkUpdateImpactKind;
  newPath: string;
  oldPath: string;
}

export interface LinkUpdateImpact {
  fileCount: number;
  linkCount: number;
  unreadableFileCount: number;
}

export interface MarkdownFileContent {
  content: string;
  name: string;
  path: string;
}

export interface RenameMarkdownFileResult {
  file: MarkdownFileContent;
  workspaceState: WorkspaceState;
}

export type CreateLinkedMarkdownFileResult = RenameMarkdownFileResult;

export interface FilesApi {
  createFolder: (input: CreateFolderInput) => Promise<RelicResult<WorkspaceState>>;
  importMarkdownFiles: (input: ImportMarkdownFilesInput) => Promise<RelicResult<WorkspaceState>>;
  importImageFile: (input: ImportImageFileInput) => Promise<RelicResult<ImportImageFileResult>>;
  readImageFile: (input: ReadImageFileInput) => Promise<RelicResult<ReadImageFileResult>>;
  readPdfFile: (input: ReadPdfFileInput) => Promise<RelicResult<ReadPdfFileResult>>;
  createLinkedMarkdownFile: (input: CreateLinkedMarkdownFileInput) => Promise<RelicResult<CreateLinkedMarkdownFileResult>>;
  createMarkdownFile: (input: CreateMarkdownFileInput) => Promise<RelicResult<WorkspaceState>>;
  getDroppedFilePath: (file: File) => string;
  duplicateMarkdownFile: (input: DuplicateMarkdownFileInput) => Promise<RelicResult<RenameMarkdownFileResult>>;
  getLinkUpdateImpact: (input: LinkUpdateImpactInput) => Promise<RelicResult<LinkUpdateImpact>>;
  moveFolder: (input: MoveFolderInput) => Promise<RelicResult<WorkspaceState>>;
  moveItemToTrash: (input: MoveItemToTrashInput) => Promise<RelicResult<WorkspaceState>>;
  moveMarkdownFile: (input: MoveMarkdownFileInput) => Promise<RelicResult<RenameMarkdownFileResult>>;
  readMarkdownFile: (input: ReadMarkdownFileInput) => Promise<RelicResult<MarkdownFileContent>>;
  renameMarkdownFile: (input: RenameMarkdownFileInput) => Promise<RelicResult<RenameMarkdownFileResult>>;
  renameFolder: (input: RenameFolderInput) => Promise<RelicResult<WorkspaceState>>;
  revealWorkspaceItem: (input: RevealWorkspaceItemInput) => Promise<RelicResult<void>>;
  startWorkspaceFileDrag: (input: StartWorkspaceFileDragInput) => void;
}

export const filesIpcContract = {
  createFolder: { channel: createFolderChannel, main: "handle", transport: "invoke", validatesInput: true },
  importMarkdownFiles: { channel: importMarkdownFilesChannel, main: "handle", transport: "invoke", validatesInput: true },
  importImageFile: { channel: importImageFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  readImageFile: { channel: readImageFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  readPdfFile: { channel: readPdfFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  createLinkedMarkdownFile: { channel: createLinkedMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  createMarkdownFile: { channel: createMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  getDroppedFilePath: { channel: null, main: "none", transport: "local", validatesInput: false },
  duplicateMarkdownFile: { channel: duplicateMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  getLinkUpdateImpact: { channel: getLinkUpdateImpactChannel, main: "handle", transport: "invoke", validatesInput: true },
  moveFolder: { channel: moveFolderChannel, main: "handle", transport: "invoke", validatesInput: true },
  moveItemToTrash: { channel: moveItemToTrashChannel, main: "handle", transport: "invoke", validatesInput: true },
  moveMarkdownFile: { channel: moveMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  readMarkdownFile: { channel: readMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  renameMarkdownFile: { channel: renameMarkdownFileChannel, main: "handle", transport: "invoke", validatesInput: true },
  renameFolder: { channel: renameFolderChannel, main: "handle", transport: "invoke", validatesInput: true },
  revealWorkspaceItem: { channel: revealWorkspaceItemChannel, main: "handle", transport: "invoke", validatesInput: true },
  startWorkspaceFileDrag: { channel: startWorkspaceFileDragChannel, main: "on", transport: "send", validatesInput: true }
} as const satisfies IpcFeatureContract;
