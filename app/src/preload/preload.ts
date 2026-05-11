import { clipboard, contextBridge, ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  cloneGitHubRepositoryChannel,
  createNewWorkspaceChannel,
  togglePinChannel,
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
  getGitHubIntegrationSettingsChannel,
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
  getMarkdownTemplatesChannel,
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChronicleChannel,
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
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  replaceInFileChannel,
  revealWorkspaceItemChannel,
  resolveGitConflictChannel,
  saveAutoSyncSettingsChannel,
  saveEditorSettingsChannel,
  saveGitHubIntegrationSettingsChannel,
  generateTitleListChannel,
  type GenerateTitleListInput,
  generateTableOfContentsChannel,
  type GenerateTableOfContentsInput,
  getFeatureTogglesChannel,
  saveFeatureTogglesChannel,
  getFrontmatterTemplatesChannel,
  saveFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveUserDefinedFieldsChannel,
  type FeatureToggles,
  type FrontmatterTemplate,
  type UserDefinedField,
  mergeFilesChannel,
  type MergeFilesInput,
  splitFileByHeadingChannel,
  type SplitFileByHeadingInput,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  switchGitBranchChannel,
  switchWorkspaceChannel,
  writeMarkdownFileChannel,
  type AppInfo,
  type AutoSyncSettings,
  type CloneGitHubRepositoryInput,
  type ChronicleEntry,
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
  type GitHubIntegrationSettings,
  type GitRemoteSummary,
  type GitRemoteSyncResult,
  type GitStatus,
  type GitSyncPreview,
  type GitTagSummary,
  type GitWorkingChange,
  type GetBacklinksInput,
  type MarkdownFileContent,
  type MarkdownTemplateSummary,
  type MoveFolderInput,
  type MoveItemToTrashInput,
  type MoveMarkdownFileInput,
  type RelicApi,
  type PushGitTagInput,
  type ReadMarkdownFileInput,
  type RemoveWorkspaceInput,
  type RenameWorkspaceInput,
  type RenameFolderInput,
  type RenameMarkdownFileInput,
  type RenameMarkdownFileResult,
  type ReplaceInFileInput,
  type ReplaceInFileResult,
  type RevealWorkspaceItemInput,
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
import type { AliasIndex } from "../shared/links";

const relicApi: RelicApi = {
  applySearchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
  cloneGitHubRepository: (input: CloneGitHubRepositoryInput) =>
    ipcRenderer.invoke(cloneGitHubRepositoryChannel, input) as Promise<RelicResult<WorkspaceState>>,
  createNewWorkspace: () =>
    ipcRenderer.invoke(createNewWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>,
  togglePin: (path: string) =>
    ipcRenderer.invoke(togglePinChannel, path) as Promise<RelicResult<WorkspaceState>>,
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
  getGitHubIntegrationSettings: () =>
    ipcRenderer.invoke(getGitHubIntegrationSettingsChannel) as Promise<RelicResult<GitHubIntegrationSettings>>,
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
  getMarkdownTemplates: () =>
    ipcRenderer.invoke(getMarkdownTemplatesChannel) as Promise<RelicResult<MarkdownTemplateSummary[]>>,
  getWorkspaceAliases: () =>
    ipcRenderer.invoke(getWorkspaceAliasesChannel) as Promise<RelicResult<AliasIndex>>,
  getWorkspaceChronicle: () =>
    ipcRenderer.invoke(getWorkspaceChronicleChannel) as Promise<RelicResult<ChronicleEntry[]>>,
  getFrontmatterValueCandidates: () =>
    ipcRenderer.invoke(getFrontmatterValueCandidatesChannel) as Promise<RelicResult<Record<string, string[]>>>,
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
  readClipboardText: () => clipboard.readText(),
  removeWorkspace: (input: RemoveWorkspaceInput) =>
    ipcRenderer.invoke(removeWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>,
  renameWorkspace: (input: RenameWorkspaceInput) =>
    ipcRenderer.invoke(renameWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>,
  renameMarkdownFile: (input: RenameMarkdownFileInput) =>
    ipcRenderer.invoke(renameMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  renameFolder: (input: RenameFolderInput) =>
    ipcRenderer.invoke(renameFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  revealWorkspaceItem: (input: RevealWorkspaceItemInput) =>
    ipcRenderer.invoke(revealWorkspaceItemChannel, input) as Promise<RelicResult<void>>,
  replaceInFile: (input: ReplaceInFileInput) =>
    ipcRenderer.invoke(replaceInFileChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
  saveEditorSettings: (input: EditorSettings) =>
    ipcRenderer.invoke(saveEditorSettingsChannel, input) as Promise<RelicResult<void>>,
  saveGitHubIntegrationSettings: (input: GitHubIntegrationSettings) =>
    ipcRenderer.invoke(saveGitHubIntegrationSettingsChannel, input) as Promise<RelicResult<void>>,
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
  writeClipboardText: (text: string) => clipboard.writeText(text),
  getGitSyncPreview: () =>
    ipcRenderer.invoke(getGitSyncPreviewChannel) as Promise<RelicResult<GitSyncPreview>>,
  getGitConflicts: () =>
    ipcRenderer.invoke(getGitConflictsChannel) as Promise<RelicResult<GitConflict[]>>,
  resolveGitConflict: (input: ResolveGitConflictInput) =>
    ipcRenderer.invoke(resolveGitConflictChannel, input) as Promise<RelicResult<GitConflict[]>>,
  getAutoSyncSettings: () =>
    ipcRenderer.invoke(getAutoSyncSettingsChannel) as Promise<RelicResult<AutoSyncSettings>>,
  saveAutoSyncSettings: (input: AutoSyncSettings) =>
    ipcRenderer.invoke(saveAutoSyncSettingsChannel, input) as Promise<RelicResult<void>>,
  generateTitleList: (input: GenerateTitleListInput) =>
    ipcRenderer.invoke(generateTitleListChannel, input) as Promise<RelicResult<string>>,
  generateTableOfContents: (input: GenerateTableOfContentsInput) =>
    ipcRenderer.invoke(generateTableOfContentsChannel, input) as Promise<RelicResult<string>>,
  getFeatureToggles: () =>
    ipcRenderer.invoke(getFeatureTogglesChannel) as Promise<RelicResult<FeatureToggles>>,
  saveFeatureToggles: (input: FeatureToggles) =>
    ipcRenderer.invoke(saveFeatureTogglesChannel, input) as Promise<RelicResult<void>>,
  getUserDefinedFields: () =>
    ipcRenderer.invoke(getUserDefinedFieldsChannel) as Promise<RelicResult<UserDefinedField[]>>,
  saveUserDefinedFields: (input: UserDefinedField[]) =>
    ipcRenderer.invoke(saveUserDefinedFieldsChannel, input) as Promise<RelicResult<void>>,
  getFrontmatterTemplates: () =>
    ipcRenderer.invoke(getFrontmatterTemplatesChannel) as Promise<RelicResult<FrontmatterTemplate[]>>,
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) =>
    ipcRenderer.invoke(saveFrontmatterTemplatesChannel, input) as Promise<RelicResult<void>>,
  mergeFiles: (input: MergeFilesInput) =>
    ipcRenderer.invoke(mergeFilesChannel, input) as Promise<RelicResult<string>>,
  splitFileByHeading: (input: SplitFileByHeadingInput) =>
    ipcRenderer.invoke(splitFileByHeadingChannel, input) as Promise<RelicResult<string[]>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
