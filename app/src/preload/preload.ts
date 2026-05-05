import { contextBridge, ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  createFolderChannel,
  createLinkedMarkdownFileChannel,
  createMarkdownFileChannel,
  duplicateMarkdownFileChannel,
  getBacklinksChannel,
  getAppInfoChannel,
  getEditorSettingsChannel,
  getGitStatusChannel,
  getWorkspaceTagsChannel,
  getWorkspaceStateChannel,
  initializeGitRepositoryChannel,
  moveFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownFileChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  replaceInFileChannel,
  saveEditorSettingsChannel,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  switchWorkspaceChannel,
  writeMarkdownFileChannel,
  getFrontmatterCandidatesChannel,
  createFrontmatterTemplateChannel,
  type AppInfo,
  type CreateFolderInput,
  type CreateLinkedMarkdownFileInput,
  type CreateLinkedMarkdownFileResult,
  type CreateMarkdownFileInput,
  type DuplicateMarkdownFileInput,
  type EditorSettings,
  type Backlink,
  type GitStatus,
  type GetBacklinksInput,
  type MarkdownFileContent,
  type MoveFolderInput,
  type MoveItemToTrashInput,
  type MoveMarkdownFileInput,
  type RelicApi,
  type ReadMarkdownFileInput,
  type RenameFolderInput,
  type RenameMarkdownFileInput,
  type RenameMarkdownFileResult,
  type ReplaceInFileInput,
  type ReplaceInFileResult,
  type SearchAndReplaceInput,
  type SearchAndReplaceMatch,
  type SearchWorkspaceInput,
  type SwitchWorkspaceInput,
  type WorkspaceState,
  type WorkspaceSearchResult,
  type WorkspaceTagSummary,
  type WriteMarkdownFileInput
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";

const relicApi: RelicApi = {
  applySearchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
  createFolder: (input: CreateFolderInput) =>
    ipcRenderer.invoke(createFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  createLinkedMarkdownFile: (input: CreateLinkedMarkdownFileInput) =>
    ipcRenderer.invoke(createLinkedMarkdownFileChannel, input) as Promise<
      RelicResult<CreateLinkedMarkdownFileResult>
    >,
  createMarkdownFile: (input: CreateMarkdownFileInput) =>
    ipcRenderer.invoke(createMarkdownFileChannel, input) as Promise<RelicResult<WorkspaceState>>,
  duplicateMarkdownFile: (input: DuplicateMarkdownFileInput) =>
    ipcRenderer.invoke(duplicateMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  getBacklinks: (input: GetBacklinksInput) =>
    ipcRenderer.invoke(getBacklinksChannel, input) as Promise<RelicResult<Backlink[]>>,
  getGitStatus: () =>
    ipcRenderer.invoke(getGitStatusChannel) as Promise<RelicResult<GitStatus>>,
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getEditorSettings: () =>
    ipcRenderer.invoke(getEditorSettingsChannel) as Promise<RelicResult<EditorSettings>>,
  getWorkspaceTags: () =>
    ipcRenderer.invoke(getWorkspaceTagsChannel) as Promise<RelicResult<WorkspaceTagSummary[]>>,
  getWorkspaceState: () =>
    ipcRenderer.invoke(getWorkspaceStateChannel) as Promise<RelicResult<WorkspaceState>>,
  moveFolder: (input: MoveFolderInput) =>
    ipcRenderer.invoke(moveFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  moveItemToTrash: (input: MoveItemToTrashInput) =>
    ipcRenderer.invoke(moveItemToTrashChannel, input) as Promise<RelicResult<WorkspaceState>>,
  moveMarkdownFile: (input: MoveMarkdownFileInput) =>
    ipcRenderer.invoke(moveMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  initializeGitRepository: () =>
    ipcRenderer.invoke(initializeGitRepositoryChannel) as Promise<RelicResult<GitStatus>>,
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
  replaceInFile: (input: ReplaceInFileInput) =>
    ipcRenderer.invoke(replaceInFileChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
  saveEditorSettings: (input: EditorSettings) =>
    ipcRenderer.invoke(saveEditorSettingsChannel, input) as Promise<RelicResult<void>>,
  searchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(searchAndReplaceChannel, input) as Promise<
      RelicResult<SearchAndReplaceMatch[]>
    >,
  searchWorkspace: (input: SearchWorkspaceInput) =>
    ipcRenderer.invoke(searchWorkspaceChannel, input) as Promise<
      RelicResult<WorkspaceSearchResult[]>
    >,
  switchWorkspace: (input: SwitchWorkspaceInput) =>
    ipcRenderer.invoke(switchWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>,
  writeMarkdownFile: (input: WriteMarkdownFileInput) =>
    ipcRenderer.invoke(writeMarkdownFileChannel, input) as Promise<RelicResult<void>>,
  getFrontmatterCandidates: () =>
    ipcRenderer.invoke(getFrontmatterCandidatesChannel) as Promise<RelicResult<Record<string, string[]>>>,
  createFrontmatterTemplate: () =>
    ipcRenderer.invoke(createFrontmatterTemplateChannel) as Promise<RelicResult<WorkspaceState>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
