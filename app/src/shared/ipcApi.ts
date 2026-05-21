import type { AliasIndex } from "./links";
import type { RelicResult } from "./result";
import type {
  TimelineChartSettings,
  UpdateTimelineChartEntryInput,
  CardbookTimelineChart
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
  MergeCardsInput,
  SplitCardByHeadingInput
} from "./ipcTools";
import type {
  AppInfo,
  Backlink,
  CreateCardFolderInput,
  CreateLinkedMarkdownCardInput,
  CreateLinkedMarkdownCardResult,
  CreateMarkdownCardInput,
  DuplicateMarkdownCardInput,
  GetBacklinksInput,
  MarkdownCardContent,
  MoveCardFolderInput,
  MoveItemToTrashInput,
  MoveMarkdownCardInput,
  ReadMarkdownCardInput,
  RemoveCardbookInput,
  RenameCardFolderInput,
  RenameMarkdownCardInput,
  RenameMarkdownCardResult,
  RenameCardbookInput,
  ReplaceInCardInput,
  ReplaceInCardResult,
  RevealCardbookItemInput,
  SearchAndReplaceInput,
  SearchAndReplaceMatch,
  SearchCardbookInput,
  SwitchCardbookInput,
  CardbookChangedEvent,
  CardbookSearchResult,
  CardbookState,
  CardbookTagSummary,
  WriteMarkdownCardInput
} from "./ipcCardbook";

export interface RelicApi {
  createNewCardbook: () => Promise<RelicResult<CardbookState>>;
  togglePin: (path: string) => Promise<RelicResult<CardbookState>>;
  createCardFolder: (input: CreateCardFolderInput) => Promise<RelicResult<CardbookState>>;
  createLinkedMarkdownCard: (
    input: CreateLinkedMarkdownCardInput
  ) => Promise<RelicResult<CreateLinkedMarkdownCardResult>>;
  createMarkdownCard: (input: CreateMarkdownCardInput) => Promise<RelicResult<CardbookState>>;
  duplicateMarkdownCard: (
    input: DuplicateMarkdownCardInput
  ) => Promise<RelicResult<RenameMarkdownCardResult>>;
  getBacklinks: (input: GetBacklinksInput) => Promise<RelicResult<Backlink[]>>;
  getAppInfo: () => Promise<RelicResult<AppInfo>>;
  getEditorSettings: () => Promise<RelicResult<EditorSettings>>;
  getCardbookAliases: () => Promise<RelicResult<AliasIndex>>;
  getCardbookTimeline: () => Promise<RelicResult<CardbookTimelineChart[]>>;
  getFrontmatterValueCandidates: () => Promise<RelicResult<Record<string, string[]>>>;
  getCardbookTags: () => Promise<RelicResult<CardbookTagSummary[]>>;
  getCardbookState: () => Promise<RelicResult<CardbookState>>;
  moveCardFolder: (input: MoveCardFolderInput) => Promise<RelicResult<CardbookState>>;
  moveItemToTrash: (input: MoveItemToTrashInput) => Promise<RelicResult<CardbookState>>;
  moveMarkdownCard: (
    input: MoveMarkdownCardInput
  ) => Promise<RelicResult<RenameMarkdownCardResult>>;
  openCardbook: () => Promise<RelicResult<CardbookState>>;
  readMarkdownCard: (input: ReadMarkdownCardInput) => Promise<RelicResult<MarkdownCardContent>>;
  readClipboardText: () => string;
  removeCardbook: (input: RemoveCardbookInput) => Promise<RelicResult<CardbookState>>;
  renameCardbook: (input: RenameCardbookInput) => Promise<RelicResult<CardbookState>>;
  renameMarkdownCard: (
    input: RenameMarkdownCardInput
  ) => Promise<RelicResult<RenameMarkdownCardResult>>;
  renameCardFolder: (input: RenameCardFolderInput) => Promise<RelicResult<CardbookState>>;
  revealCardbookItem: (input: RevealCardbookItemInput) => Promise<RelicResult<void>>;
  applySearchAndReplace: (input: SearchAndReplaceInput) => Promise<RelicResult<ReplaceInCardResult>>;
  replaceInCard: (input: ReplaceInCardInput) => Promise<RelicResult<ReplaceInCardResult>>;
  saveEditorSettings: (input: EditorSettings) => Promise<RelicResult<void>>;
  searchAndReplace: (
    input: SearchAndReplaceInput
  ) => Promise<RelicResult<SearchAndReplaceMatch[]>>;
  searchCardbook: (input: SearchCardbookInput) => Promise<RelicResult<CardbookSearchResult[]>>;
  switchCardbook: (input: SwitchCardbookInput) => Promise<RelicResult<CardbookState>>;
  writeMarkdownCard: (input: WriteMarkdownCardInput) => Promise<RelicResult<void>>;
  writeClipboardText: (text: string) => void;
  saveCardbookTimelineCharts: (input: TimelineChartSettings[]) => Promise<RelicResult<CardbookTimelineChart[]>>;
  updateTimelineChartEntry: (input: UpdateTimelineChartEntryInput) => Promise<RelicResult<CardbookTimelineChart[]>>;
  generateTitleList: (input: GenerateTitleListInput) => Promise<RelicResult<string>>;
  generateTableOfContents: (input: GenerateTableOfContentsInput) => Promise<RelicResult<string>>;
  getFeatureToggles: () => Promise<RelicResult<FeatureToggles>>;
  saveFeatureToggles: (input: FeatureToggles) => Promise<RelicResult<void>>;
  getUserDefinedFields: () => Promise<RelicResult<UserDefinedField[]>>;
  saveUserDefinedFields: (input: UserDefinedField[]) => Promise<RelicResult<void>>;
  getFrontmatterTemplates: () => Promise<RelicResult<FrontmatterTemplate[]>>;
  saveFrontmatterTemplates: (input: FrontmatterTemplate[]) => Promise<RelicResult<void>>;
  mergeCards: (input: MergeCardsInput) => Promise<RelicResult<string>>;
  splitCardByHeading: (input: SplitCardByHeadingInput) => Promise<RelicResult<string[]>>;
  onCardbookChanged: (callback: (event: CardbookChangedEvent) => void) => () => void;
}
