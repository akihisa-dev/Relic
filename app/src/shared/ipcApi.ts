import type { AliasIndex } from "./links";
import type { RelicResult } from "./result";
import type {
  ChronicleCalendarSettings,
  ChartSettings,
  UpdateChartEntryInput,
  WorkspaceChart
} from "./ipcCharts";
import type {
  AppUiSettings,
  EditorSettings,
  FeatureToggles,
  FrontmatterTemplate,
  UserDefinedField
} from "./ipcSettings";
import type {
  CopyDiagramSvgInput,
  OutputCopyResult,
  OutputPrintResult,
  OutputSavedResult,
  PrintPreviewInput,
  SaveDiagramSvgInput,
  SavePreviewAsPdfInput
} from "./ipcOutput";
import type {
  GenerateTableOfContentsInput,
  GenerateTitleListInput,
  MergeFilesInput,
  SplitFileByHeadingInput
} from "./ipcTools";
import type {
  ApplyAIWorkspaceOperationsInput,
  AISettingsState,
  AIWorkspaceMessagePreview,
  AIWorkspaceState,
  ClearAIWorkspaceDataInput,
  CreateAIWorkspaceChatInput,
  DeleteAIWorkspaceChatInput,
  DiscardAIWorkspaceOperationsInput,
  PreviewAIWorkspaceMessageInput,
  RebuildAIWorkspaceIndexInput,
  SaveAIModelInput,
  SaveAIProviderInput,
  SaveOpenAIAPIKeyInput,
  SelectAIWorkspaceChatInput,
  SendAIWorkspaceMessageInput,
  TestOpenAIAPIKeyResult
} from "./ipcAiWorkspace";
import type {
  AppInfo,
  Backlink,
  CreateFolderInput,
  CreateLinkedMarkdownFileInput,
  CreateLinkedMarkdownFileResult,
  CreateMarkdownFileInput,
  DuplicateMarkdownFileInput,
  GetBacklinksInput,
  LinkUpdateImpact,
  LinkUpdateImpactInput,
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

export interface RelicApi {
  copyDiagramSvg: (input: CopyDiagramSvgInput) => Promise<RelicResult<OutputCopyResult>>;
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
  printPreview: (input: PrintPreviewInput) => Promise<RelicResult<OutputPrintResult>>;
  saveDiagramSvg: (input: SaveDiagramSvgInput) => Promise<RelicResult<OutputSavedResult>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  savePreviewAsPdf: (input: SavePreviewAsPdfInput) => Promise<RelicResult<OutputSavedResult>>;
  searchAndReplace: (
    input: SearchAndReplaceInput
  ) => Promise<RelicResult<SearchAndReplaceMatch[]>>;
  searchWorkspace: (input: SearchWorkspaceInput) => Promise<RelicResult<WorkspaceSearchResultSet>>;
  switchWorkspace: (input: SwitchWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  writeMarkdownFile: (input: WriteMarkdownFileInput) => Promise<RelicResult<void>>;
  writeClipboardText: (text: string) => void;
  saveWorkspaceChronicleCalendars: (input: ChronicleCalendarSettings[]) => Promise<RelicResult<ChronicleCalendarSettings[]>>;
  saveWorkspaceCharts: (input: ChartSettings[]) => Promise<RelicResult<WorkspaceChart[]>>;
  updateChartEntry: (input: UpdateChartEntryInput) => Promise<RelicResult<WorkspaceChart[]>>;
  generateTitleList: (input: GenerateTitleListInput) => Promise<RelicResult<string>>;
  generateTableOfContents: (input: GenerateTableOfContentsInput) => Promise<RelicResult<string>>;
  getFeatureToggles: () => Promise<RelicResult<FeatureToggles>>;
  saveFeatureToggles: (input: FeatureToggles) => Promise<RelicResult<void>>;
  getAppUiSettings: () => Promise<RelicResult<AppUiSettings>>;
  saveAppUiSettings: (input: AppUiSettings) => Promise<RelicResult<AppUiSettings>>;
  getUserDefinedFields: () => Promise<RelicResult<UserDefinedField[]>>;
  saveUserDefinedFields: (input: UserDefinedField[]) => Promise<RelicResult<void>>;
  getFrontmatterTemplates: () => Promise<RelicResult<FrontmatterTemplate[]>>;
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) => Promise<RelicResult<void>>;
  mergeFiles: (input: MergeFilesInput) => Promise<RelicResult<string>>;
  splitFileByHeading: (input: SplitFileByHeadingInput) => Promise<RelicResult<string[]>>;
  getAIWorkspaceState: () => Promise<RelicResult<AIWorkspaceState>>;
  createAIWorkspaceChat: (input: CreateAIWorkspaceChatInput) => Promise<RelicResult<AIWorkspaceState>>;
  selectAIWorkspaceChat: (input: SelectAIWorkspaceChatInput) => Promise<RelicResult<AIWorkspaceState>>;
  deleteAIWorkspaceChat: (input: DeleteAIWorkspaceChatInput) => Promise<RelicResult<AIWorkspaceState>>;
  getAISettings: () => Promise<RelicResult<AISettingsState>>;
  saveAIProvider: (input: SaveAIProviderInput) => Promise<RelicResult<AISettingsState>>;
  saveAIModel: (input: SaveAIModelInput) => Promise<RelicResult<AISettingsState>>;
  saveOpenAIAPIKey: (input: SaveOpenAIAPIKeyInput) => Promise<RelicResult<AISettingsState>>;
  deleteOpenAIAPIKey: () => Promise<RelicResult<AISettingsState>>;
  testOpenAIAPIKey: () => Promise<RelicResult<TestOpenAIAPIKeyResult>>;
  rebuildAIWorkspaceIndex: (input: RebuildAIWorkspaceIndexInput) => Promise<RelicResult<AIWorkspaceState>>;
  previewAIWorkspaceMessage: (input: PreviewAIWorkspaceMessageInput) => Promise<RelicResult<AIWorkspaceMessagePreview>>;
  sendAIWorkspaceMessage: (input: SendAIWorkspaceMessageInput) => Promise<RelicResult<AIWorkspaceState>>;
  cancelAIWorkspaceMessage: () => Promise<RelicResult<void>>;
  applyAIWorkspaceOperations: (input: ApplyAIWorkspaceOperationsInput) => Promise<RelicResult<AIWorkspaceState>>;
  discardAIWorkspaceOperations: (input: DiscardAIWorkspaceOperationsInput) => Promise<RelicResult<AIWorkspaceState>>;
  clearAIWorkspaceData: (input: ClearAIWorkspaceDataInput) => Promise<RelicResult<AIWorkspaceState>>;
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => () => void;
  onWindowCloseRequested: (callback: (event: WindowCloseRequestEvent) => void) => () => void;
  respondToWindowCloseRequest: (input: WindowCloseResponseInput) => void;
}
