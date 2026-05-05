import { contextBridge, ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  cloneGitHubRepositoryChannel,
  connectGitRemoteChannel,
  connectGitHubChannel,
  createFolderChannel,
  createGitBranchChannel,
  createGitCommitChannel,
  createGitTagChannel,
  createLinkedMarkdownFileChannel,
  createMarkdownFileChannel,
  disconnectGitHubChannel,
  deleteGitTagChannel,
  duplicateMarkdownFileChannel,
  getAutoSyncSettingsChannel,
  getBacklinksChannel,
  getAppInfoChannel,
  getGitHubAuthStatusChannel,
  getGitBranchesChannel,
  getGitCommitHistoryChannel,
  getGitCommitDiffChannel,
  getGitConflictsChannel,
  getGitRemotesChannel,
  getGitSyncPreviewChannel,
  getGitTagsChannel,
  getEditorSettingsChannel,
  getGitStatusChannel,
  getGitWorkingChangesChannel,
  getWorkspaceTagsChannel,
  getWorkspaceStateChannel,
  initializeGitRepositoryChannel,
  moveFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownFileChannel,
  openWorkspaceChannel,
  pullGitBranchChannel,
  pushGitBranchChannel,
  pushGitTagChannel,
  readMarkdownFileChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  replaceInFileChannel,
  resolveGitConflictChannel,
  saveAutoSyncSettingsChannel,
  saveEditorSettingsChannel,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  switchGitBranchChannel,
  switchWorkspaceChannel,
  writeMarkdownFileChannel,
  getFrontmatterCandidatesChannel,
  createFrontmatterTemplateChannel,
  type AppInfo,
  type AutoSyncSettings,
  type CloneGitHubRepositoryInput,
  type ConnectGitRemoteInput,
  type CreateFolderInput,
  type CreateGitBranchInput,
  type CreateGitCommitInput,
  type CreateGitTagInput,
  type CreateLinkedMarkdownFileInput,
  type CreateLinkedMarkdownFileResult,
  type CreateMarkdownFileInput,
  type DeleteGitTagInput,
  type DuplicateMarkdownFileInput,
  type EditorSettings,
  type Backlink,
  type GitCommitDiff,
  type GitBranchSummary,
  type GitCommitSummary,
  type GitConflict,
  type GitHubAuthStatus,
  type GitRemoteSummary,
  type GitRemoteSyncResult,
  type GitStatus,
  type GitSyncPreview,
  type GitTagSummary,
  type GitWorkingChange,
  type GetBacklinksInput,
  type MarkdownFileContent,
  type MoveFolderInput,
  type MoveItemToTrashInput,
  type MoveMarkdownFileInput,
  type RelicApi,
  type PushGitTagInput,
  type ReadMarkdownFileInput,
  type RenameFolderInput,
  type RenameMarkdownFileInput,
  type RenameMarkdownFileResult,
  type ReplaceInFileInput,
  type ReplaceInFileResult,
  type ResolveGitConflictInput,
  type SearchAndReplaceInput,
  type SearchAndReplaceMatch,
  type SearchWorkspaceInput,
  type SwitchGitBranchInput,
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
  cloneGitHubRepository: (input: CloneGitHubRepositoryInput) =>
    ipcRenderer.invoke(cloneGitHubRepositoryChannel, input) as Promise<RelicResult<WorkspaceState>>,
  connectGitRemote: (input: ConnectGitRemoteInput) =>
    ipcRenderer.invoke(connectGitRemoteChannel, input) as Promise<RelicResult<GitRemoteSummary[]>>,
  connectGitHubAccount: () =>
    ipcRenderer.invoke(connectGitHubChannel) as Promise<RelicResult<GitHubAuthStatus>>,
  createFolder: (input: CreateFolderInput) =>
    ipcRenderer.invoke(createFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  createGitBranch: (input: CreateGitBranchInput) =>
    ipcRenderer.invoke(createGitBranchChannel, input) as Promise<RelicResult<GitBranchSummary[]>>,
  createGitCommit: (input: CreateGitCommitInput) =>
    ipcRenderer.invoke(createGitCommitChannel, input) as Promise<RelicResult<GitCommitSummary>>,
  createGitTag: (input: CreateGitTagInput) =>
    ipcRenderer.invoke(createGitTagChannel, input) as Promise<RelicResult<GitTagSummary[]>>,
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
  disconnectGitHubAccount: () =>
    ipcRenderer.invoke(disconnectGitHubChannel) as Promise<RelicResult<GitHubAuthStatus>>,
  deleteGitTag: (input: DeleteGitTagInput) =>
    ipcRenderer.invoke(deleteGitTagChannel, input) as Promise<RelicResult<GitTagSummary[]>>,
  getBacklinks: (input: GetBacklinksInput) =>
    ipcRenderer.invoke(getBacklinksChannel, input) as Promise<RelicResult<Backlink[]>>,
  getGitHubAuthStatus: () =>
    ipcRenderer.invoke(getGitHubAuthStatusChannel) as Promise<RelicResult<GitHubAuthStatus>>,
  getGitBranches: () =>
    ipcRenderer.invoke(getGitBranchesChannel) as Promise<RelicResult<GitBranchSummary[]>>,
  getGitCommitHistory: () =>
    ipcRenderer.invoke(getGitCommitHistoryChannel) as Promise<RelicResult<GitCommitSummary[]>>,
  getGitCommitDiff: (hash: string) =>
    ipcRenderer.invoke(getGitCommitDiffChannel, hash) as Promise<RelicResult<GitCommitDiff>>,
  getGitStatus: () =>
    ipcRenderer.invoke(getGitStatusChannel) as Promise<RelicResult<GitStatus>>,
  getGitRemotes: () =>
    ipcRenderer.invoke(getGitRemotesChannel) as Promise<RelicResult<GitRemoteSummary[]>>,
  getGitTags: () =>
    ipcRenderer.invoke(getGitTagsChannel) as Promise<RelicResult<GitTagSummary[]>>,
  getGitWorkingChanges: () =>
    ipcRenderer.invoke(getGitWorkingChangesChannel) as Promise<RelicResult<GitWorkingChange[]>>,
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
  pullGitBranch: () =>
    ipcRenderer.invoke(pullGitBranchChannel) as Promise<RelicResult<GitRemoteSyncResult>>,
  pushGitBranch: () =>
    ipcRenderer.invoke(pushGitBranchChannel) as Promise<RelicResult<GitRemoteSyncResult>>,
  pushGitTag: (input: PushGitTagInput) =>
    ipcRenderer.invoke(pushGitTagChannel, input) as Promise<RelicResult<GitRemoteSyncResult>>,
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
  switchGitBranch: (input: SwitchGitBranchInput) =>
    ipcRenderer.invoke(switchGitBranchChannel, input) as Promise<RelicResult<GitBranchSummary[]>>,
  writeMarkdownFile: (input: WriteMarkdownFileInput) =>
    ipcRenderer.invoke(writeMarkdownFileChannel, input) as Promise<RelicResult<void>>,
  getFrontmatterCandidates: () =>
    ipcRenderer.invoke(getFrontmatterCandidatesChannel) as Promise<RelicResult<Record<string, string[]>>>,
  createFrontmatterTemplate: () =>
    ipcRenderer.invoke(createFrontmatterTemplateChannel) as Promise<RelicResult<WorkspaceState>>,
  getGitSyncPreview: () =>
    ipcRenderer.invoke(getGitSyncPreviewChannel) as Promise<RelicResult<GitSyncPreview>>,
  getGitConflicts: () =>
    ipcRenderer.invoke(getGitConflictsChannel) as Promise<RelicResult<GitConflict[]>>,
  resolveGitConflict: (input: ResolveGitConflictInput) =>
    ipcRenderer.invoke(resolveGitConflictChannel, input) as Promise<RelicResult<GitConflict[]>>,
  getAutoSyncSettings: () =>
    ipcRenderer.invoke(getAutoSyncSettingsChannel) as Promise<RelicResult<AutoSyncSettings>>,
  saveAutoSyncSettings: (input: AutoSyncSettings) =>
    ipcRenderer.invoke(saveAutoSyncSettingsChannel, input) as Promise<RelicResult<void>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
