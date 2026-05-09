import type { RelicResult } from "./result";

export const getAppInfoChannel = "app:getInfo";
export const getGitHubAuthStatusChannel = "github:getAuthStatus";
export const connectGitHubChannel = "github:connect";
export const disconnectGitHubChannel = "github:disconnect";
export const getGitHubIntegrationSettingsChannel = "github:getIntegrationSettings";
export const saveGitHubIntegrationSettingsChannel = "github:saveIntegrationSettings";
export const createFolderChannel = "workspace:createFolder";
export const createLinkedMarkdownFileChannel = "workspace:createLinkedMarkdownFile";
export const createMarkdownFileChannel = "workspace:createMarkdownFile";
export const duplicateMarkdownFileChannel = "workspace:duplicateMarkdownFile";
export const getBacklinksChannel = "workspace:getBacklinks";
export const getGitStatusChannel = "workspace:getGitStatus";
export const getGitCommitHistoryChannel = "workspace:getGitCommitHistory";
export const getGitCommitDiffChannel = "workspace:getGitCommitDiff";
export const getGitWorkingChangesChannel = "workspace:getGitWorkingChanges";
export const getGitBranchesChannel = "workspace:getGitBranches";
export const getGitTagsChannel = "workspace:getGitTags";
export const getWorkspaceTagsChannel = "workspace:getTags";
export const getMarkdownTemplatesChannel = "workspace:getMarkdownTemplates";
export const getWorkspaceStateChannel = "workspace:getState";
export const initializeGitRepositoryChannel = "workspace:initializeGitRepository";
export const createGitCommitChannel = "workspace:createGitCommit";
export const createGitBranchChannel = "workspace:createGitBranch";
export const switchGitBranchChannel = "workspace:switchGitBranch";
export const createGitTagChannel = "workspace:createGitTag";
export const deleteGitTagChannel = "workspace:deleteGitTag";
export const getGitRemotesChannel = "workspace:getGitRemotes";
export const connectGitRemoteChannel = "workspace:connectGitRemote";
export const pullGitBranchChannel = "workspace:pullGitBranch";
export const pushGitBranchChannel = "workspace:pushGitBranch";
export const pushGitTagChannel = "workspace:pushGitTag";
export const moveItemToTrashChannel = "workspace:moveItemToTrash";
export const openWorkspaceChannel = "workspace:open";
export const readMarkdownFileChannel = "workspace:readMarkdownFile";
export const removeWorkspaceChannel = "workspace:remove";
export const renameMarkdownFileChannel = "workspace:renameMarkdownFile";
export const renameFolderChannel = "workspace:renameFolder";
export const searchWorkspaceChannel = "workspace:search";
export const switchWorkspaceChannel = "workspace:switch";
export const writeMarkdownFileChannel = "workspace:writeMarkdownFile";
export const moveMarkdownFileChannel = "workspace:moveMarkdownFile";
export const moveFolderChannel = "workspace:moveFolder";
export const replaceInFileChannel = "workspace:replaceInFile";
export const searchAndReplaceChannel = "workspace:searchAndReplace";
export const applySearchAndReplaceChannel = "workspace:applySearchAndReplace";
export const getEditorSettingsChannel = "editor:getSettings";
export const saveEditorSettingsChannel = "editor:saveSettings";
export const createNewWorkspaceChannel = "workspace:createNew";
export const togglePinChannel = "workspace:togglePin";
export const cloneGitHubRepositoryChannel = "workspace:cloneGitHubRepository";
export const getGitSyncPreviewChannel = "workspace:getGitSyncPreview";
export const getGitConflictsChannel = "workspace:getGitConflicts";
export const resolveGitConflictChannel = "workspace:resolveGitConflict";
export const getAutoSyncSettingsChannel = "app:getAutoSyncSettings";
export const saveAutoSyncSettingsChannel = "app:saveAutoSyncSettings";
export const generateTitleListChannel = "tools:generateTitleList";
export const generateTableOfContentsChannel = "tools:generateTableOfContents";
export const getFeatureTogglesChannel = "app:getFeatureToggles";
export const saveFeatureTogglesChannel = "app:saveFeatureToggles";
export const getUserDefinedFieldsChannel = "app:getUserDefinedFields";
export const saveUserDefinedFieldsChannel = "app:saveUserDefinedFields";
export const getFrontmatterTemplatesChannel = "app:getFrontmatterTemplates";
export const saveFrontmatterTemplatesChannel = "app:saveFrontmatterTemplates";
export const mergeFilesChannel = "tools:mergeFiles";
export const splitFileByHeadingChannel = "tools:splitFileByHeading";

export interface GenerateTitleListInput {
  filterFolder?: string;
  filterTag?: string;
  outputFolder: string;
  outputName: string;
  sortBy: "name" | "mtime";
}

export interface GenerateTableOfContentsInput {
  includeSubfolders: boolean;
  outputFolder: string;
  outputName: string;
  targetFolder: string;
}

export type MergeFilterType = "folder" | "frontmatter" | "tag" | "all";
export type MergeSortBy = "name" | "mtime" | "ctime";

export interface MergeFilesInput {
  frontmatterField?: string;
  filterType: MergeFilterType;
  filterValue: string;
  insertFilenameHeading: boolean;
  outputFolder: string;
  outputName: string;
  sortBy: MergeSortBy;
}

export type SplitHeadingLevel = 1 | 2 | 3;

export interface SplitFileByHeadingInput {
  headingLevel: SplitHeadingLevel;
  outputFolder: string;
  sourcePath: string;
}

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
  pinnedPaths: string[];
  workspaces: WorkspaceSummary[];
}

export interface CreateMarkdownFileInput {
  name: string;
  templatePath?: string;
}

export interface CreateLinkedMarkdownFileInput {
  path: string;
}

export interface CreateFolderInput {
  name: string;
}

export interface ReadMarkdownFileInput {
  path: string;
}

export interface GetBacklinksInput {
  path: string;
}

export type SearchMode = "fullText" | "fileName" | "tag" | "regex" | "frontmatter";

export interface SearchWorkspaceInput {
  frontmatterField?: string;
  mode: SearchMode;
  query: string;
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

export interface MoveMarkdownFileInput {
  destinationFolder: string;
  path: string;
}

export interface MoveFolderInput {
  destinationFolder: string;
  path: string;
}

export interface ReplaceInFileInput {
  isRegex: boolean;
  path: string;
  replacement: string;
  searchQuery: string;
}

export interface SearchAndReplaceMatch {
  lineNumber: number;
  lineText: string;
  newLineText: string;
  path: string;
}

export interface SearchAndReplaceInput {
  isRegex: boolean;
  replacement: string;
  searchQuery: string;
}

export interface ReplaceInFileResult {
  count: number;
}

export interface SwitchWorkspaceInput {
  workspaceId: string;
}

export interface RemoveWorkspaceInput {
  workspaceId: string;
}

export interface MarkdownFileContent {
  content: string;
  name: string;
  path: string;
}

export interface MarkdownTemplateSummary {
  name: string;
  path: string;
}

export interface Backlink {
  count: number;
  sourceName: string;
  sourcePath: string;
}

export interface WorkspaceTagSummary {
  count: number;
  tag: string;
}

export interface GitStatus {
  currentBranch: string | null;
  initialized: boolean;
}

export interface GitWorkingChange {
  path: string;
  status: "added" | "deleted" | "modified" | "untracked";
}

export interface GitCommitSummary {
  author: string;
  changedFiles: string[];
  date: string;
  hash: string;
  message: string;
}

export interface GitCommitDiffEntry {
  after: string;
  before: string;
  path: string;
  status: "added" | "deleted" | "modified";
}

export interface GitCommitDiff {
  commit: GitCommitSummary;
  entries: GitCommitDiffEntry[];
}

export interface GitBranchSummary {
  isCurrent: boolean;
  name: string;
  upstream: string | null;
}

export interface GitTagSummary {
  annotated: boolean;
  date: string;
  message: string | null;
  name: string;
  targetHash: string;
  targetMessage: string | null;
}

export interface GitHubAuthStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
  scopes: string[];
  tokenType: string | null;
}

export interface GitRemoteSummary {
  isOrigin: boolean;
  name: string;
  url: string;
}

export interface CreateGitCommitInput {
  message: string;
}

export interface CreateGitBranchInput {
  name: string;
}

export interface SwitchGitBranchInput {
  allowDirty?: boolean;
  name: string;
}

export interface CreateGitTagInput {
  hash?: string;
  message?: string;
  name: string;
  taggerEmail?: string;
  taggerName?: string;
}

export interface DeleteGitTagInput {
  name: string;
}

export interface ConnectGitRemoteInput {
  url: string;
}

export interface PushGitTagInput {
  name: string;
}

export interface CloneGitHubRepositoryInput {
  url: string;
}

export type AutoSyncInterval = 5 | 15 | 30 | 60;

export interface AutoSyncSettings {
  autoPull: boolean;
  autoPush: boolean;
  intervalMinutes: AutoSyncInterval;
}

export const defaultAutoSyncSettings: AutoSyncSettings = {
  autoPull: false,
  autoPush: false,
  intervalMinutes: 15
};

export const autoSyncFeatureEnabled = false;

export interface GitHubIntegrationSettings {
  clientId: string;
  scopes: string[];
}

export const defaultGitHubIntegrationSettings: GitHubIntegrationSettings = {
  clientId: "",
  scopes: []
};

export interface FeatureToggles {
  git: boolean;
  tools: boolean;
  frontmatter: boolean;
  rightPanel: boolean;
}

export type UserDefinedFieldType = "text" | "number" | "date" | "boolean" | "select" | "multi-select" | "tags" | "url";

export interface UserDefinedField {
  choices?: string[];
  name: string;
  type: UserDefinedFieldType;
}

export interface FrontmatterTemplate {
  fieldNames: string[];
  name: string;
}

export const defaultUserDefinedFields: UserDefinedField[] = [];
export const defaultFrontmatterTemplates: FrontmatterTemplate[] = [];

export const defaultFeatureToggles: FeatureToggles = {
  git: true,
  tools: true,
  frontmatter: true,
  rightPanel: true
};

export interface GitSyncPreview {
  branch: string;
  incomingCommits: GitCommitSummary[];
  outgoingChanges: GitWorkingChange[];
  remoteName: string;
  remoteUrl: string;
  upstream: string;
}

export interface GitConflict {
  ours: string;
  path: string;
  theirs: string;
}

export interface ResolveGitConflictInput {
  path: string;
  resolution: "ours" | "theirs";
}

export interface GitRemoteSyncResult {
  errors: string[];
  message: string;
  updatedRefs: string[];
}

export interface WorkspaceSearchResult {
  fileName: string;
  lineNumber: number | null;
  lineText: string;
  path: string;
}

export interface WriteMarkdownFileInput {
  content: string;
  path: string;
}

export type EditorFont = "system" | "mincho" | "mono";
export type EditorMaxWidth = "550px" | "660px" | "800px" | "none";

export type AppTheme = "light" | "dark" | "system";
export type AppLanguage = "system" | "en" | "ja";

export interface EditorSettings {
  font: EditorFont;
  fontSize: number;
  language: AppLanguage;
  lineHeight: number;
  maxWidth: EditorMaxWidth;
  showLineNumbers: boolean;
  spellCheck: boolean;
  theme: AppTheme;
}

export const defaultEditorSettings: EditorSettings = {
  font: "system",
  fontSize: 16,
  language: "en",
  lineHeight: 1.7,
  maxWidth: "660px",
  showLineNumbers: false,
  spellCheck: true,
  theme: "system"
};

export interface RenameMarkdownFileResult {
  file: MarkdownFileContent;
  workspaceState: WorkspaceState;
}

export type CreateLinkedMarkdownFileResult = RenameMarkdownFileResult;

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
  cloneGitHubRepository: (input: CloneGitHubRepositoryInput) => Promise<RelicResult<WorkspaceState>>;
  createNewWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  togglePin: (path: string) => Promise<RelicResult<WorkspaceState>>;
  connectGitRemote: (input: ConnectGitRemoteInput) => Promise<RelicResult<GitRemoteSummary[]>>;
  connectGitHubAccount: () => Promise<RelicResult<GitHubAuthStatus>>;
  createFolder: (input: CreateFolderInput) => Promise<RelicResult<WorkspaceState>>;
  createGitBranch: (input: CreateGitBranchInput) => Promise<RelicResult<GitBranchSummary[]>>;
  createGitCommit: (input: CreateGitCommitInput) => Promise<RelicResult<GitCommitSummary>>;
  createLinkedMarkdownFile: (
    input: CreateLinkedMarkdownFileInput
  ) => Promise<RelicResult<CreateLinkedMarkdownFileResult>>;
  createMarkdownFile: (input: CreateMarkdownFileInput) => Promise<RelicResult<WorkspaceState>>;
  duplicateMarkdownFile: (
    input: DuplicateMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  disconnectGitHubAccount: () => Promise<RelicResult<GitHubAuthStatus>>;
  getGitHubIntegrationSettings: () => Promise<RelicResult<GitHubIntegrationSettings>>;
  getBacklinks: (input: GetBacklinksInput) => Promise<RelicResult<Backlink[]>>;
  getGitHubAuthStatus: () => Promise<RelicResult<GitHubAuthStatus>>;
  getGitBranches: () => Promise<RelicResult<GitBranchSummary[]>>;
  getGitCommitHistory: () => Promise<RelicResult<GitCommitSummary[]>>;
  getGitCommitDiff: (hash: string) => Promise<RelicResult<GitCommitDiff>>;
  getGitStatus: () => Promise<RelicResult<GitStatus>>;
  getGitWorkingChanges: () => Promise<RelicResult<GitWorkingChange[]>>;
  getGitRemotes: () => Promise<RelicResult<GitRemoteSummary[]>>;
  getGitTags: () => Promise<RelicResult<GitTagSummary[]>>;
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getEditorSettings: () => Promise<RelicResult<EditorSettings>>;
  getMarkdownTemplates: () => Promise<RelicResult<MarkdownTemplateSummary[]>>;
  getWorkspaceTags: () => Promise<RelicResult<WorkspaceTagSummary[]>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  moveFolder: (input: MoveFolderInput) => Promise<RelicResult<WorkspaceState>>;
  moveItemToTrash: (input: MoveItemToTrashInput) => Promise<RelicResult<WorkspaceState>>;
  moveMarkdownFile: (
    input: MoveMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  initializeGitRepository: () => Promise<RelicResult<GitStatus>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  pullGitBranch: () => Promise<RelicResult<GitRemoteSyncResult>>;
  pushGitBranch: () => Promise<RelicResult<GitRemoteSyncResult>>;
  pushGitTag: (input: PushGitTagInput) => Promise<RelicResult<GitRemoteSyncResult>>;
  readMarkdownFile: (input: ReadMarkdownFileInput) => Promise<RelicResult<MarkdownFileContent>>;
  removeWorkspace: (input: RemoveWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  renameMarkdownFile: (
    input: RenameMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  renameFolder: (input: RenameFolderInput) => Promise<RelicResult<WorkspaceState>>;
  applySearchAndReplace: (input: SearchAndReplaceInput) => Promise<RelicResult<ReplaceInFileResult>>;
  replaceInFile: (input: ReplaceInFileInput) => Promise<RelicResult<ReplaceInFileResult>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  saveGitHubIntegrationSettings: (input: GitHubIntegrationSettings) => Promise<RelicResult<void>>;
  searchAndReplace: (
    input: SearchAndReplaceInput
  ) => Promise<RelicResult<SearchAndReplaceMatch[]>>;
  searchWorkspace: (input: SearchWorkspaceInput) => Promise<RelicResult<WorkspaceSearchResult[]>>;
  switchGitBranch: (input: SwitchGitBranchInput) => Promise<RelicResult<GitBranchSummary[]>>;
  switchWorkspace: (input: SwitchWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  writeMarkdownFile: (input: WriteMarkdownFileInput) => Promise<RelicResult<void>>;
  createGitTag: (input: CreateGitTagInput) => Promise<RelicResult<GitTagSummary[]>>;
  deleteGitTag: (input: DeleteGitTagInput) => Promise<RelicResult<GitTagSummary[]>>;
  getGitSyncPreview: () => Promise<RelicResult<GitSyncPreview>>;
  getGitConflicts: () => Promise<RelicResult<GitConflict[]>>;
  resolveGitConflict: (input: ResolveGitConflictInput) => Promise<RelicResult<GitConflict[]>>;
  getAutoSyncSettings: () => Promise<RelicResult<AutoSyncSettings>>;
  saveAutoSyncSettings: (input: AutoSyncSettings) => Promise<RelicResult<void>>;
  generateTitleList: (input: GenerateTitleListInput) => Promise<RelicResult<string>>;
  generateTableOfContents: (input: GenerateTableOfContentsInput) => Promise<RelicResult<string>>;
  getFeatureToggles: () => Promise<RelicResult<FeatureToggles>>;
  saveFeatureToggles: (input: FeatureToggles) => Promise<RelicResult<void>>;
  getUserDefinedFields: () => Promise<RelicResult<UserDefinedField[]>>;
  saveUserDefinedFields: (input: UserDefinedField[]) => Promise<RelicResult<void>>;
  getFrontmatterTemplates: () => Promise<RelicResult<FrontmatterTemplate[]>>;
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) => Promise<RelicResult<void>>;
  mergeFiles: (input: MergeFilesInput) => Promise<RelicResult<string>>;
  splitFileByHeading: (input: SplitFileByHeadingInput) => Promise<RelicResult<string[]>>;
}
