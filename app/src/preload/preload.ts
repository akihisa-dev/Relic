import { clipboard, contextBridge, ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  applyAIWorkspaceOperationsChannel,
  clearAIWorkspaceDataChannel,
  deleteOpenAIAPIKeyChannel,
  discardAIWorkspaceOperationsChannel,
  createNewWorkspaceChannel,
  copyDiagramSvgChannel,
  type CopyDiagramSvgInput,
  togglePinChannel,
  createFolderChannel,
  createLinkedMarkdownFileChannel,
  createMarkdownFileChannel,
  duplicateMarkdownFileChannel,
  getBacklinksChannel,
  getAIWorkspaceStateChannel,
  getAISettingsChannel,
  getAppInfoChannel,
  getEditorSettingsChannel,
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChartsChannel,
  getWorkspaceChronicleCalendarsChannel,
  getLinkUpdateImpactChannel,
  getWorkspaceTagsChannel,
  getWorkspaceStateChannel,
  workspaceChangedChannel,
  windowCloseRequestedChannel,
  windowCloseResponseChannel,
  moveFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownFileChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  previewAIWorkspaceMessageChannel,
  rebuildAIWorkspaceIndexChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  replaceInFileChannel,
  revealWorkspaceItemChannel,
  saveWorkspaceChartsChannel,
  saveWorkspaceChronicleCalendarsChannel,
  updateChartEntryChannel,
  saveEditorSettingsChannel,
  saveOpenAIAPIKeyChannel,
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
  printPreviewChannel,
  type PrintPreviewInput,
  saveDiagramSvgChannel,
  type SaveDiagramSvgInput,
  savePreviewAsPdfChannel,
  type SavePreviewAsPdfInput,
  type OutputCopyResult,
  type OutputPrintResult,
  type OutputSavedResult,
  splitFileByHeadingChannel,
  type SplitFileByHeadingInput,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  sendAIWorkspaceMessageChannel,
  testOpenAIAPIKeyChannel,
  switchWorkspaceChannel,
  writeMarkdownFileChannel,
  type AIWorkspaceState,
  type AISettingsState,
  type ApplyAIWorkspaceOperationsInput,
  type AppInfo,
  type CreateFolderInput,
  type CreateLinkedMarkdownFileInput,
  type CreateLinkedMarkdownFileResult,
  type CreateMarkdownFileInput,
  type DuplicateMarkdownFileInput,
  type EditorSettings,
  type Backlink,
  type ClearAIWorkspaceDataInput,
  type DiscardAIWorkspaceOperationsInput,
  type ChronicleCalendarSettings,
  type GetBacklinksInput,
  type ChartSettings,
  type LinkUpdateImpact,
  type LinkUpdateImpactInput,
  type UpdateChartEntryInput,
  type MarkdownFileContent,
  type MoveFolderInput,
  type MoveItemToTrashInput,
  type MoveMarkdownFileInput,
  type AIWorkspaceMessagePreview,
  type PreviewAIWorkspaceMessageInput,
  type RelicApi,
  type ReadMarkdownFileInput,
  type RebuildAIWorkspaceIndexInput,
  type SaveOpenAIAPIKeyInput,
  type RemoveWorkspaceInput,
  type RenameWorkspaceInput,
  type RenameFolderInput,
  type RenameMarkdownFileInput,
  type RenameMarkdownFileResult,
  type ReplaceInFileInput,
  type ReplaceInFileResult,
  type RevealWorkspaceItemInput,
  type SearchAndReplaceInput,
  type SearchAndReplaceMatch,
  type SearchWorkspaceInput,
  type SendAIWorkspaceMessageInput,
  type TestOpenAIAPIKeyResult,
  type SwitchWorkspaceInput,
  type WorkspaceChangedEvent,
  type WindowCloseRequestEvent,
  type WindowCloseResponseInput,
  type WorkspaceState,
  type WorkspaceChart,
  type WorkspaceSearchResultSet,
  type WorkspaceTagSummary,
  type WriteMarkdownFileInput
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { AliasIndex } from "../shared/links";

const relicApi: RelicApi = {
  applySearchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
  copyDiagramSvg: (input: CopyDiagramSvgInput) =>
    ipcRenderer.invoke(copyDiagramSvgChannel, input) as Promise<RelicResult<OutputCopyResult>>,
  createNewWorkspace: () =>
    ipcRenderer.invoke(createNewWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>,
  togglePin: (path: string) =>
    ipcRenderer.invoke(togglePinChannel, path) as Promise<RelicResult<WorkspaceState>>,
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
  getAIWorkspaceState: () =>
    ipcRenderer.invoke(getAIWorkspaceStateChannel) as Promise<RelicResult<AIWorkspaceState>>,
  getAISettings: () =>
    ipcRenderer.invoke(getAISettingsChannel) as Promise<RelicResult<AISettingsState>>,
  saveOpenAIAPIKey: (input: SaveOpenAIAPIKeyInput) =>
    ipcRenderer.invoke(saveOpenAIAPIKeyChannel, input) as Promise<RelicResult<AISettingsState>>,
  deleteOpenAIAPIKey: () =>
    ipcRenderer.invoke(deleteOpenAIAPIKeyChannel) as Promise<RelicResult<AISettingsState>>,
  testOpenAIAPIKey: () =>
    ipcRenderer.invoke(testOpenAIAPIKeyChannel) as Promise<RelicResult<TestOpenAIAPIKeyResult>>,
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getEditorSettings: () =>
    ipcRenderer.invoke(getEditorSettingsChannel) as Promise<RelicResult<EditorSettings>>,
  getWorkspaceAliases: () =>
    ipcRenderer.invoke(getWorkspaceAliasesChannel) as Promise<RelicResult<AliasIndex>>,
  getWorkspaceCharts: () =>
    ipcRenderer.invoke(getWorkspaceChartsChannel) as Promise<RelicResult<WorkspaceChart[]>>,
  getWorkspaceChronicleCalendars: () =>
    ipcRenderer.invoke(getWorkspaceChronicleCalendarsChannel) as Promise<RelicResult<ChronicleCalendarSettings[]>>,
  getFrontmatterValueCandidates: () =>
    ipcRenderer.invoke(getFrontmatterValueCandidatesChannel) as Promise<RelicResult<Record<string, string[]>>>,
  getWorkspaceTags: () =>
    ipcRenderer.invoke(getWorkspaceTagsChannel) as Promise<RelicResult<WorkspaceTagSummary[]>>,
  getWorkspaceState: () =>
    ipcRenderer.invoke(getWorkspaceStateChannel) as Promise<RelicResult<WorkspaceState>>,
  getLinkUpdateImpact: (input: LinkUpdateImpactInput) =>
    ipcRenderer.invoke(getLinkUpdateImpactChannel, input) as Promise<RelicResult<LinkUpdateImpact>>,
  moveFolder: (input: MoveFolderInput) =>
    ipcRenderer.invoke(moveFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  moveItemToTrash: (input: MoveItemToTrashInput) =>
    ipcRenderer.invoke(moveItemToTrashChannel, input) as Promise<RelicResult<WorkspaceState>>,
  moveMarkdownFile: (input: MoveMarkdownFileInput) =>
    ipcRenderer.invoke(moveMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  openWorkspace: () =>
    ipcRenderer.invoke(openWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>,
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
  printPreview: (input: PrintPreviewInput) =>
    ipcRenderer.invoke(printPreviewChannel, input) as Promise<RelicResult<OutputPrintResult>>,
  saveDiagramSvg: (input: SaveDiagramSvgInput) =>
    ipcRenderer.invoke(saveDiagramSvgChannel, input) as Promise<RelicResult<OutputSavedResult>>,
  saveEditorSettings: (input: EditorSettings) =>
    ipcRenderer.invoke(saveEditorSettingsChannel, input) as Promise<RelicResult<void>>,
  savePreviewAsPdf: (input: SavePreviewAsPdfInput) =>
    ipcRenderer.invoke(savePreviewAsPdfChannel, input) as Promise<RelicResult<OutputSavedResult>>,
  searchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(searchAndReplaceChannel, input) as Promise<
      RelicResult<SearchAndReplaceMatch[]>
    >,
  searchWorkspace: (input: SearchWorkspaceInput) =>
    ipcRenderer.invoke(searchWorkspaceChannel, input) as Promise<
      RelicResult<WorkspaceSearchResultSet>
    >,
  rebuildAIWorkspaceIndex: (input: RebuildAIWorkspaceIndexInput) =>
    ipcRenderer.invoke(rebuildAIWorkspaceIndexChannel, input) as Promise<RelicResult<AIWorkspaceState>>,
  previewAIWorkspaceMessage: (input: PreviewAIWorkspaceMessageInput) =>
    ipcRenderer.invoke(previewAIWorkspaceMessageChannel, input) as Promise<RelicResult<AIWorkspaceMessagePreview>>,
  sendAIWorkspaceMessage: (input: SendAIWorkspaceMessageInput) =>
    ipcRenderer.invoke(sendAIWorkspaceMessageChannel, input) as Promise<RelicResult<AIWorkspaceState>>,
  applyAIWorkspaceOperations: (input: ApplyAIWorkspaceOperationsInput) =>
    ipcRenderer.invoke(applyAIWorkspaceOperationsChannel, input) as Promise<RelicResult<AIWorkspaceState>>,
  discardAIWorkspaceOperations: (input: DiscardAIWorkspaceOperationsInput) =>
    ipcRenderer.invoke(discardAIWorkspaceOperationsChannel, input) as Promise<RelicResult<AIWorkspaceState>>,
  clearAIWorkspaceData: (input: ClearAIWorkspaceDataInput) =>
    ipcRenderer.invoke(clearAIWorkspaceDataChannel, input) as Promise<RelicResult<AIWorkspaceState>>,
  switchWorkspace: (input: SwitchWorkspaceInput) =>
    ipcRenderer.invoke(switchWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>,
  writeMarkdownFile: (input: WriteMarkdownFileInput) =>
    ipcRenderer.invoke(writeMarkdownFileChannel, input) as Promise<RelicResult<void>>,
  writeClipboardText: (text: string) => clipboard.writeText(text),
  saveWorkspaceChronicleCalendars: (input: ChronicleCalendarSettings[]) =>
    ipcRenderer.invoke(saveWorkspaceChronicleCalendarsChannel, input) as Promise<RelicResult<ChronicleCalendarSettings[]>>,
  saveWorkspaceCharts: (input: ChartSettings[]) =>
    ipcRenderer.invoke(saveWorkspaceChartsChannel, input) as Promise<RelicResult<WorkspaceChart[]>>,
  updateChartEntry: (input: UpdateChartEntryInput) =>
    ipcRenderer.invoke(updateChartEntryChannel, input) as Promise<RelicResult<WorkspaceChart[]>>,
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
    ipcRenderer.invoke(splitFileByHeadingChannel, input) as Promise<RelicResult<string[]>>,
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceChangedEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(workspaceChangedChannel, listener);
    return () => ipcRenderer.removeListener(workspaceChangedChannel, listener);
  },
  onWindowCloseRequested: (callback: (event: WindowCloseRequestEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: WindowCloseRequestEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(windowCloseRequestedChannel, listener);
    return () => ipcRenderer.removeListener(windowCloseRequestedChannel, listener);
  },
  respondToWindowCloseRequest: (input: WindowCloseResponseInput) => {
    ipcRenderer.send(windowCloseResponseChannel, input);
  }
};

contextBridge.exposeInMainWorld("relic", relicApi);
