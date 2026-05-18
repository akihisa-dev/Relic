import type { AliasIndex } from "./links";
import type { RelicResult } from "./result";
import type {
  GanttChartSettings,
  UpdateGanttChartEntryInput,
  WorkspaceGanttChart
} from "./ipcCharts";
import type {
  EditorSettings,
  FeatureToggles,
  FrontmatterTemplate,
  UserDefinedField
} from "./ipcSettings";
import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput,
  SplitFileByHeadingInput
} from "./ipcTools";
import type {
  AppInfo,
  Backlink,
  CreateFolderInput,
  CreateLinkedMarkdownFileInput,
  CreateLinkedMarkdownFileResult,
  CreateMarkdownFileInput,
  DuplicateMarkdownFileInput,
  GetBacklinksInput,
  MarkdownFileContent,
  MoveFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownFileInput,
  ReadMarkdownFileInput,
  RemoveWorkspaceInput,
  RenameFolderInput,
  RenameMarkdownFileInput,
  RenameMarkdownFileResult,
  RenameWorkspaceInput,
  ReplaceInFileInput,
  ReplaceInFileResult,
  RevealWorkspaceItemInput,
  SearchAndReplaceInput,
  SearchAndReplaceMatch,
  SearchWorkspaceInput,
  SwitchWorkspaceInput,
  WorkspaceChangedEvent,
  WorkspaceGraph,
  WorkspaceSearchResult,
  WorkspaceState,
  WorkspaceTagSummary,
  WriteMarkdownFileInput
} from "./ipcWorkspace";

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
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => () => void;
}
