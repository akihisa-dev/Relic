import { contextBridge, ipcRenderer } from "electron";

import {
  createFolderChannel,
  createMarkdownFileChannel,
  getAppInfoChannel,
  getWorkspaceStateChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  renameMarkdownFileChannel,
  switchWorkspaceChannel,
  type AppInfo,
  type CreateFolderInput,
  type CreateMarkdownFileInput,
  type MarkdownFileContent,
  type RelicApi,
  type ReadMarkdownFileInput,
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
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getWorkspaceState: () =>
    ipcRenderer.invoke(getWorkspaceStateChannel) as Promise<RelicResult<WorkspaceState>>,
  openWorkspace: () =>
    ipcRenderer.invoke(openWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>,
  readMarkdownFile: (input: ReadMarkdownFileInput) =>
    ipcRenderer.invoke(readMarkdownFileChannel, input) as Promise<RelicResult<MarkdownFileContent>>,
  renameMarkdownFile: (input: RenameMarkdownFileInput) =>
    ipcRenderer.invoke(renameMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  switchWorkspace: (input: SwitchWorkspaceInput) =>
    ipcRenderer.invoke(switchWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
