import type { AliasIndex } from "./links";
import type { RelicResult } from "./result";

export const getAppInfoChannel = "app:getInfo";
export const createFolderChannel = "workspace:createFolder";
export const createLinkedMarkdownFileChannel = "workspace:createLinkedMarkdownFile";
export const createMarkdownFileChannel = "workspace:createMarkdownFile";
export const duplicateMarkdownFileChannel = "workspace:duplicateMarkdownFile";
export const getBacklinksChannel = "workspace:getBacklinks";
export const getWorkspaceTagsChannel = "workspace:getTags";
export const getWorkspaceAliasesChannel = "workspace:getAliases";
export const getWorkspaceChronicleChannel = "workspace:getChronicle";
export const getWorkspaceGraphChannel = "workspace:getGraph";
export const saveWorkspaceGanttChartsChannel = "workspace:saveGanttCharts";
export const updateGanttChartEntryChannel = "workspace:updateGanttChartEntry";
export const getFrontmatterValueCandidatesChannel = "workspace:getFrontmatterValueCandidates";
export const getWorkspaceStateChannel = "workspace:getState";
export const moveItemToTrashChannel = "workspace:moveItemToTrash";
export const openWorkspaceChannel = "workspace:open";
export const readMarkdownFileChannel = "workspace:readMarkdownFile";
export const removeWorkspaceChannel = "workspace:remove";
export const renameWorkspaceChannel = "workspace:rename";
export const renameMarkdownFileChannel = "workspace:renameMarkdownFile";
export const renameFolderChannel = "workspace:renameFolder";
export const revealWorkspaceItemChannel = "workspace:revealItem";
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

export type GanttChartSource = "chronicle" | "date";

export interface GanttChartSettings {
  filePaths?: string[];
  id: string;
  name: string;
  source: GanttChartSource;
}

export interface GanttChartEntry {
  endLabel: string;
  endValue: number;
  fileName: string;
  path: string;
  startLabel: string;
  startValue: number;
}

export interface WorkspaceGanttChart extends GanttChartSettings {
  entries: GanttChartEntry[];
}

export type GanttChartEntryEditKind = "move" | "resize-start" | "resize-end";

export interface UpdateGanttChartEntryInput {
  endValue: number;
  kind: GanttChartEntryEditKind;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}

export interface WorkspaceState {
  activeWorkspace: WorkspaceSummary | null;
  fileTree: WorkspaceTreeNode[];
  pinnedPaths: string[];
  workspaces: WorkspaceSummary[];
}

export interface CreateMarkdownFileInput {
  name: string;
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

export interface RevealWorkspaceItemInput {
  path: string;
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

export interface RenameWorkspaceInput {
  name: string;
  workspaceId: string;
}

export interface MarkdownFileContent {
  content: string;
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

export interface WorkspaceGraphNode {
  folder: string;
  name: string;
  path: string;
  tags: string[];
}

export interface WorkspaceGraphEdge {
  sourcePath: string;
  targetPath: string;
}

export interface WorkspaceGraph {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}

export interface FeatureToggles {
  tools: boolean;
  frontmatter: boolean;
  rightPanel: boolean;
}

export type UserDefinedFieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "time"
  | "boolean"
  | "select"
  | "multi-select"
  | "url";

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
  tools: true,
  frontmatter: true,
  rightPanel: true
};

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
  createNewWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  togglePin: (path: string) => Promise<RelicResult<WorkspaceState>>;
  createFolder: (input: CreateFolderInput) => Promise<RelicResult<WorkspaceState>>;
  createLinkedMarkdownFile: (
    input: CreateLinkedMarkdownFileInput
  ) => Promise<RelicResult<CreateLinkedMarkdownFileResult>>;
  createMarkdownFile: (input: CreateMarkdownFileInput) => Promise<RelicResult<WorkspaceState>>;
  duplicateMarkdownFile: (
    input: DuplicateMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  getBacklinks: (input: GetBacklinksInput) => Promise<RelicResult<Backlink[]>>;
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getEditorSettings: () => Promise<RelicResult<EditorSettings>>;
  getWorkspaceAliases: () => Promise<RelicResult<AliasIndex>>;
  getWorkspaceChronicle: () => Promise<RelicResult<WorkspaceGanttChart[]>>;
  getWorkspaceGraph: () => Promise<RelicResult<WorkspaceGraph>>;
  getFrontmatterValueCandidates: () => Promise<RelicResult<Record<string, string[]>>>;
  getWorkspaceTags: () => Promise<RelicResult<WorkspaceTagSummary[]>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  moveFolder: (input: MoveFolderInput) => Promise<RelicResult<WorkspaceState>>;
  moveItemToTrash: (input: MoveItemToTrashInput) => Promise<RelicResult<WorkspaceState>>;
  moveMarkdownFile: (
    input: MoveMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  readMarkdownFile: (input: ReadMarkdownFileInput) => Promise<RelicResult<MarkdownFileContent>>;
  readClipboardText: () => string;
  removeWorkspace: (input: RemoveWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  renameWorkspace: (input: RenameWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  renameMarkdownFile: (
    input: RenameMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  renameFolder: (input: RenameFolderInput) => Promise<RelicResult<WorkspaceState>>;
  revealWorkspaceItem: (input: RevealWorkspaceItemInput) => Promise<RelicResult<void>>;
  applySearchAndReplace: (input: SearchAndReplaceInput) => Promise<RelicResult<ReplaceInFileResult>>;
  replaceInFile: (input: ReplaceInFileInput) => Promise<RelicResult<ReplaceInFileResult>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  searchAndReplace: (
    input: SearchAndReplaceInput
  ) => Promise<RelicResult<SearchAndReplaceMatch[]>>;
  searchWorkspace: (input: SearchWorkspaceInput) => Promise<RelicResult<WorkspaceSearchResult[]>>;
  switchWorkspace: (input: SwitchWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  writeMarkdownFile: (input: WriteMarkdownFileInput) => Promise<RelicResult<void>>;
  writeClipboardText: (text: string) => void;
  saveWorkspaceGanttCharts: (input: GanttChartSettings[]) => Promise<RelicResult<WorkspaceGanttChart[]>>;
  updateGanttChartEntry: (input: UpdateGanttChartEntryInput) => Promise<RelicResult<WorkspaceGanttChart[]>>;
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
