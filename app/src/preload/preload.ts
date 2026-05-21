import { clipboard, contextBridge, ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  createNewCardbookChannel,
  togglePinChannel,
  createCardFolderChannel,
  createLinkedMarkdownCardChannel,
  createMarkdownCardChannel,
  duplicateMarkdownCardChannel,
  getBacklinksChannel,
  getAppInfoChannel,
  getEditorSettingsChannel,
  getFrontmatterValueCandidatesChannel,
  getCardbookAliasesChannel,
  getCardbookTimelineChannel,
  getCardbookTagsChannel,
  getCardbookStateChannel,
  cardbookChangedChannel,
  moveCardFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownCardChannel,
  openCardbookChannel,
  readMarkdownCardChannel,
  removeCardbookChannel,
  renameCardbookChannel,
  renameCardFolderChannel,
  renameMarkdownCardChannel,
  replaceInCardChannel,
  revealCardbookItemChannel,
  saveCardbookTimelineChartsChannel,
  updateTimelineChartEntryChannel,
  saveEditorSettingsChannel,
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
  mergeCardsChannel,
  type MergeCardsInput,
  splitCardByHeadingChannel,
  type SplitCardByHeadingInput,
  searchAndReplaceChannel,
  searchCardbookChannel,
  switchCardbookChannel,
  writeMarkdownCardChannel,
  type AppInfo,
  type CreateCardFolderInput,
  type CreateLinkedMarkdownCardInput,
  type CreateLinkedMarkdownCardResult,
  type CreateMarkdownCardInput,
  type DuplicateMarkdownCardInput,
  type EditorSettings,
  type Backlink,
  type GetBacklinksInput,
  type TimelineChartSettings,
  type UpdateTimelineChartEntryInput,
  type MarkdownCardContent,
  type MoveCardFolderInput,
  type MoveItemToTrashInput,
  type MoveMarkdownCardInput,
  type RelicApi,
  type ReadMarkdownCardInput,
  type RemoveCardbookInput,
  type RenameCardbookInput,
  type RenameCardFolderInput,
  type RenameMarkdownCardInput,
  type RenameMarkdownCardResult,
  type ReplaceInCardInput,
  type ReplaceInCardResult,
  type RevealCardbookItemInput,
  type SearchAndReplaceInput,
  type SearchAndReplaceMatch,
  type SearchCardbookInput,
  type SwitchCardbookInput,
  type CardbookChangedEvent,
  type CardbookState,
  type CardbookTimelineChart,
  type CardbookSearchResult,
  type CardbookTagSummary,
  type WriteMarkdownCardInput
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { AliasIndex } from "../shared/links";

const relicApi: RelicApi = {
  applySearchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input) as Promise<RelicResult<ReplaceInCardResult>>,
  createNewCardbook: () =>
    ipcRenderer.invoke(createNewCardbookChannel) as Promise<RelicResult<CardbookState>>,
  togglePin: (path: string) =>
    ipcRenderer.invoke(togglePinChannel, path) as Promise<RelicResult<CardbookState>>,
  createCardFolder: (input: CreateCardFolderInput) =>
    ipcRenderer.invoke(createCardFolderChannel, input) as Promise<RelicResult<CardbookState>>,
  createLinkedMarkdownCard: (input: CreateLinkedMarkdownCardInput) =>
    ipcRenderer.invoke(createLinkedMarkdownCardChannel, input) as Promise<
      RelicResult<CreateLinkedMarkdownCardResult>
    >,
  createMarkdownCard: (input: CreateMarkdownCardInput) =>
    ipcRenderer.invoke(createMarkdownCardChannel, input) as Promise<RelicResult<CardbookState>>,
  duplicateMarkdownCard: (input: DuplicateMarkdownCardInput) =>
    ipcRenderer.invoke(duplicateMarkdownCardChannel, input) as Promise<
      RelicResult<RenameMarkdownCardResult>
    >,
  getBacklinks: (input: GetBacklinksInput) =>
    ipcRenderer.invoke(getBacklinksChannel, input) as Promise<RelicResult<Backlink[]>>,
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getEditorSettings: () =>
    ipcRenderer.invoke(getEditorSettingsChannel) as Promise<RelicResult<EditorSettings>>,
  getCardbookAliases: () =>
    ipcRenderer.invoke(getCardbookAliasesChannel) as Promise<RelicResult<AliasIndex>>,
  getCardbookTimeline: () =>
    ipcRenderer.invoke(getCardbookTimelineChannel) as Promise<RelicResult<CardbookTimelineChart[]>>,
  getFrontmatterValueCandidates: () =>
    ipcRenderer.invoke(getFrontmatterValueCandidatesChannel) as Promise<RelicResult<Record<string, string[]>>>,
  getCardbookTags: () =>
    ipcRenderer.invoke(getCardbookTagsChannel) as Promise<RelicResult<CardbookTagSummary[]>>,
  getCardbookState: () =>
    ipcRenderer.invoke(getCardbookStateChannel) as Promise<RelicResult<CardbookState>>,
  moveCardFolder: (input: MoveCardFolderInput) =>
    ipcRenderer.invoke(moveCardFolderChannel, input) as Promise<RelicResult<CardbookState>>,
  moveItemToTrash: (input: MoveItemToTrashInput) =>
    ipcRenderer.invoke(moveItemToTrashChannel, input) as Promise<RelicResult<CardbookState>>,
  moveMarkdownCard: (input: MoveMarkdownCardInput) =>
    ipcRenderer.invoke(moveMarkdownCardChannel, input) as Promise<
      RelicResult<RenameMarkdownCardResult>
    >,
  openCardbook: () =>
    ipcRenderer.invoke(openCardbookChannel) as Promise<RelicResult<CardbookState>>,
  readMarkdownCard: (input: ReadMarkdownCardInput) =>
    ipcRenderer.invoke(readMarkdownCardChannel, input) as Promise<RelicResult<MarkdownCardContent>>,
  readClipboardText: () => clipboard.readText(),
  removeCardbook: (input: RemoveCardbookInput) =>
    ipcRenderer.invoke(removeCardbookChannel, input) as Promise<RelicResult<CardbookState>>,
  renameCardbook: (input: RenameCardbookInput) =>
    ipcRenderer.invoke(renameCardbookChannel, input) as Promise<RelicResult<CardbookState>>,
  renameMarkdownCard: (input: RenameMarkdownCardInput) =>
    ipcRenderer.invoke(renameMarkdownCardChannel, input) as Promise<
      RelicResult<RenameMarkdownCardResult>
    >,
  renameCardFolder: (input: RenameCardFolderInput) =>
    ipcRenderer.invoke(renameCardFolderChannel, input) as Promise<RelicResult<CardbookState>>,
  revealCardbookItem: (input: RevealCardbookItemInput) =>
    ipcRenderer.invoke(revealCardbookItemChannel, input) as Promise<RelicResult<void>>,
  replaceInCard: (input: ReplaceInCardInput) =>
    ipcRenderer.invoke(replaceInCardChannel, input) as Promise<RelicResult<ReplaceInCardResult>>,
  saveEditorSettings: (input: EditorSettings) =>
    ipcRenderer.invoke(saveEditorSettingsChannel, input) as Promise<RelicResult<void>>,
  searchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(searchAndReplaceChannel, input) as Promise<
      RelicResult<SearchAndReplaceMatch[]>
    >,
  searchCardbook: (input: SearchCardbookInput) =>
    ipcRenderer.invoke(searchCardbookChannel, input) as Promise<
      RelicResult<CardbookSearchResult[]>
    >,
  switchCardbook: (input: SwitchCardbookInput) =>
    ipcRenderer.invoke(switchCardbookChannel, input) as Promise<RelicResult<CardbookState>>,
  writeMarkdownCard: (input: WriteMarkdownCardInput) =>
    ipcRenderer.invoke(writeMarkdownCardChannel, input) as Promise<RelicResult<void>>,
  writeClipboardText: (text: string) => clipboard.writeText(text),
  saveCardbookTimelineCharts: (input: TimelineChartSettings[]) =>
    ipcRenderer.invoke(saveCardbookTimelineChartsChannel, input) as Promise<RelicResult<CardbookTimelineChart[]>>,
  updateTimelineChartEntry: (input: UpdateTimelineChartEntryInput) =>
    ipcRenderer.invoke(updateTimelineChartEntryChannel, input) as Promise<RelicResult<CardbookTimelineChart[]>>,
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
  mergeCards: (input: MergeCardsInput) =>
    ipcRenderer.invoke(mergeCardsChannel, input) as Promise<RelicResult<string>>,
  splitCardByHeading: (input: SplitCardByHeadingInput) =>
    ipcRenderer.invoke(splitCardByHeadingChannel, input) as Promise<RelicResult<string[]>>,
  onCardbookChanged: (callback: (event: CardbookChangedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CardbookChangedEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(cardbookChangedChannel, listener);
    return () => ipcRenderer.removeListener(cardbookChangedChannel, listener);
  }
};

contextBridge.exposeInMainWorld("relic", relicApi);
