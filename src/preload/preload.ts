import { contextBridge, ipcRenderer } from "electron";

import {
  createFolderChannel,
  createMarkdownFileChannel,
  duplicateMarkdownFileChannel,
  getAppInfoChannel,
  getWorkspaceStateChannel,
  moveItemToTrashChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  switchWorkspaceChannel,
  type AppInfo,
  type CreateFolderInput,
  type CreateMarkdownFileInput,
  type DuplicateMarkdownFileInput,
  type MarkdownFileContent,
  type MoveItemToTrashInput,
  type RelicApi,
  type ReadMarkdownFileInput,
  type RenameFolderInput,
  type RenameMarkdownFileInput,
  type RenameMarkdownFileResult,
  type SwitchWorkspaceInput,
  type WorkspaceState
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";

const relicApi: RelicApi = {
  createFolder: (input: CreateFolderInput) =>
    ipcRenderer.invoke(createFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  createMarkdownFile: (input: CreateMarkdownFileInput) =>
    ipcRenderer.invoke(createMarkdownFileChannel, input) as Promise<RelicResult<WorkspaceState>>,
  duplicateMarkdownFile: (input: DuplicateMarkdownFileInput) =>
    ipcRenderer.invoke(duplicateMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getWorkspaceState: () =>
    ipcRenderer.invoke(getWorkspaceStateChannel) as Promise<RelicResult<WorkspaceState>>,
  moveItemToTrash: (input: MoveItemToTrashInput) =>
    ipcRenderer.invoke(moveItemToTrashChannel, input) as Promise<RelicResult<WorkspaceState>>,
  openWorkspace: () =>
    ipcRenderer.invoke(openWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>,
  readMarkdownFile: (input: ReadMarkdownFileInput) =>
    ipcRenderer.invoke(readMarkdownFileChannel, input) as Promise<RelicResult<MarkdownFileContent>>,
  renameMarkdownFile: (input: RenameMarkdownFileInput) =>
    ipcRenderer.invoke(renameMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  renameFolder: (input: RenameFolderInput) =>
    ipcRenderer.invoke(renameFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  switchWorkspace: (input: SwitchWorkspaceInput) =>
    ipcRenderer.invoke(switchWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
