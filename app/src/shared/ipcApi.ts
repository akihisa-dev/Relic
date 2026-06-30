import type { AliasIndex } from "./links";
import type { RelicResult } from "./result";
import type {
  ChronicleCalendarSettings,
  ChartSettings,
  UpdateChartEntryInput,
  WorkspaceChart
} from "./ipcCharts";
import type {
  EditorSettings,
  FeatureToggles,
  FrontmatterTemplate,
  UserDefinedField
} from "./ipcSettings";
import type {
  CopyDiagramSvgInput,
  OutputCopyResult,
  OutputSavedResult,
  SaveDiagramSvgInput,
  SavePreviewAsPdfInput
} from "./ipcOutput";
import type {
  GenerateTagIndexInput,
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput
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
  ImportImageFileInput,
  ImportImageFileResult,
  ImportMarkdownFilesInput,
  LinkUpdateImpact,
  LinkUpdateImpactInput,
  MarkdownFileContent,
  MoveFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownFileInput,
  ReadMarkdownFileInput,
  ReadImageFileInput,
  ReadImageFileResult,
  RemoveWorkspaceInput,
  RenameFolderInput,
  RenameMarkdownFileInput,
  RenameMarkdownFileResult,
  RenameWorkspaceInput,
  ReplaceInFileInput,
  ReplaceInFileResult,
  ApplySearchAndReplaceResult,
  RevealWorkspaceItemInput,
  SearchAndReplaceInput,
  SearchAndReplacePreviewResult,
  SearchWorkspaceInput,
  StartWorkspaceFileDragInput,
  SwitchWorkspaceInput,
  WorkspaceChangedEvent,
  WorkspaceSearchResultSet,
  WorkspaceState,
  WorkspaceTagSummary,
  WriteMarkdownFileInput
} from "./ipcWorkspace";

export interface WindowCloseRequestEvent {
  requestId: string;
}

export interface WindowCloseResponseInput {
  ok: boolean;
  requestId: string;
}

export const relicApiContractVersion = 1;

export interface CopyEditorTextToClipboardInput {
  text: string;
}

export interface RelicApi {
  apiContractVersion: typeof relicApiContractVersion;
  copyDiagramSvg: (input: CopyDiagramSvgInput) => Promise<RelicResult<OutputCopyResult>>;
  createNewWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  togglePin: (path: string) => Promise<RelicResult<WorkspaceState>>;
  createFolder: (input: CreateFolderInput) => Promise<RelicResult<WorkspaceState>>;
  importMarkdownFiles: (input: ImportMarkdownFilesInput) => Promise<RelicResult<WorkspaceState>>;
  importImageFile: (input: ImportImageFileInput) => Promise<RelicResult<ImportImageFileResult>>;
  readImageFile: (input: ReadImageFileInput) => Promise<RelicResult<ReadImageFileResult>>;
  createLinkedMarkdownFile: (
    input: CreateLinkedMarkdownFileInput
  ) => Promise<RelicResult<CreateLinkedMarkdownFileResult>>;
  createMarkdownFile: (input: CreateMarkdownFileInput) => Promise<RelicResult<WorkspaceState>>;
  getDroppedFilePath: (file: File) => string;
  duplicateMarkdownFile: (
    input: DuplicateMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  getBacklinks: (input: GetBacklinksInput) => Promise<RelicResult<Backlink[]>>;
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getEditorSettings: () => Promise<RelicResult<EditorSettings>>;
  getWorkspaceAliases: () => Promise<RelicResult<AliasIndex>>;
  getWorkspaceCharts: () => Promise<RelicResult<WorkspaceChart[]>>;
  getWorkspaceChronicleCalendars: () => Promise<RelicResult<ChronicleCalendarSettings[]>>;
  getFrontmatterValueCandidates: () => Promise<RelicResult<Record<string, string[]>>>;
  getWorkspaceTags: () => Promise<RelicResult<WorkspaceTagSummary[]>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  getLinkUpdateImpact: (input: LinkUpdateImpactInput) => Promise<RelicResult<LinkUpdateImpact>>;
  moveFolder: (input: MoveFolderInput) => Promise<RelicResult<WorkspaceState>>;
  moveItemToTrash: (input: MoveItemToTrashInput) => Promise<RelicResult<WorkspaceState>>;
  moveMarkdownFile: (
    input: MoveMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  readMarkdownFile: (input: ReadMarkdownFileInput) => Promise<RelicResult<MarkdownFileContent>>;
  removeWorkspace: (input: RemoveWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  renameWorkspace: (input: RenameWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  renameMarkdownFile: (
    input: RenameMarkdownFileInput
  ) => Promise<RelicResult<RenameMarkdownFileResult>>;
  renameFolder: (input: RenameFolderInput) => Promise<RelicResult<WorkspaceState>>;
  revealWorkspaceItem: (input: RevealWorkspaceItemInput) => Promise<RelicResult<void>>;
  startWorkspaceFileDrag: (input: StartWorkspaceFileDragInput) => void;
  applySearchAndReplace: (input: SearchAndReplaceInput) => Promise<RelicResult<ApplySearchAndReplaceResult>>;
  replaceInFile: (input: ReplaceInFileInput) => Promise<RelicResult<ReplaceInFileResult>>;
  saveDiagramSvg: (input: SaveDiagramSvgInput) => Promise<RelicResult<OutputSavedResult>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  savePreviewAsPdf: (input: SavePreviewAsPdfInput) => Promise<RelicResult<OutputSavedResult>>;
  searchAndReplace: (
    input: SearchAndReplaceInput
  ) => Promise<RelicResult<SearchAndReplacePreviewResult>>;
  searchWorkspace: (input: SearchWorkspaceInput) => Promise<RelicResult<WorkspaceSearchResultSet>>;
  switchWorkspace: (input: SwitchWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  writeMarkdownFile: (input: WriteMarkdownFileInput) => Promise<RelicResult<void>>;
  copyEditorTextToClipboard: (input: CopyEditorTextToClipboardInput) => Promise<RelicResult<void>>;
  saveWorkspaceChronicleCalendars: (input: ChronicleCalendarSettings[]) => Promise<RelicResult<ChronicleCalendarSettings[]>>;
  saveWorkspaceCharts: (input: ChartSettings[]) => Promise<RelicResult<WorkspaceChart[]>>;
  updateChartEntry: (input: UpdateChartEntryInput) => Promise<RelicResult<WorkspaceChart[]>>;
  generateTitleList: (input: GenerateTitleListInput) => Promise<RelicResult<string>>;
  generateTableOfContents: (input: GenerateTableOfContentsInput) => Promise<RelicResult<string>>;
  generateTagIndex: (input: GenerateTagIndexInput) => Promise<RelicResult<string>>;
  getFeatureToggles: () => Promise<RelicResult<FeatureToggles>>;
  saveFeatureToggles: (input: FeatureToggles) => Promise<RelicResult<void>>;
  getUserDefinedFields: () => Promise<RelicResult<UserDefinedField[]>>;
  saveUserDefinedFields: (input: UserDefinedField[]) => Promise<RelicResult<void>>;
  getFrontmatterTemplates: () => Promise<RelicResult<FrontmatterTemplate[]>>;
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) => Promise<RelicResult<void>>;
  mergeFiles: (input: MergeFilesInput) => Promise<RelicResult<string>>;
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => () => void;
  onWindowCloseRequested: (callback: (event: WindowCloseRequestEvent) => void) => () => void;
  respondToWindowCloseRequest: (input: WindowCloseResponseInput) => void;
}
