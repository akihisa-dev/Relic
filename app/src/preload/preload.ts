import { clipboard, contextBridge, ipcRenderer } from "electron";

import {
  applySearchAndReplaceChannel,
  createNewWorkspaceChannel,
  togglePinChannel,
  createFolderChannel,
  createLinkedMarkdownFileChannel,
  createMarkdownFileChannel,
  duplicateMarkdownFileChannel,
  getBacklinksChannel,
  getAppInfoChannel,
  getEditorSettingsChannel,
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChronicleChannel,
  getWorkspaceChronicleCalendarsChannel,
  getWorkspaceTagsChannel,
  getWorkspaceStateChannel,
  workspaceChangedChannel,
  moveFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownFileChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  replaceInFileChannel,
  revealWorkspaceItemChannel,
  saveWorkspaceGanttChartsChannel,
  saveWorkspaceChronicleCalendarsChannel,
  updateGanttChartEntryChannel,
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
  mergeFilesChannel,
  type MergeFilesInput,
  splitFileByHeadingChannel,
  type SplitFileByHeadingInput,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  switchWorkspaceChannel,
  writeMarkdownFileChannel,
  type AppInfo,
  type CreateFolderInput,
  type CreateLinkedMarkdownFileInput,
  type CreateLinkedMarkdownFileResult,
  type CreateMarkdownFileInput,
  type DuplicateMarkdownFileInput,
  type EditorSettings,
  type Backlink,
  type ChronicleCalendarSettings,
  type GetBacklinksInput,
  type GanttChartSettings,
  type UpdateGanttChartEntryInput,
  type MarkdownFileContent,
  type MoveFolderInput,
  type MoveItemToTrashInput,
  type MoveMarkdownFileInput,
  type RelicApi,
  type ReadMarkdownFileInput,
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
  type SwitchWorkspaceInput,
  type WorkspaceChangedEvent,
  type WorkspaceState,
  type WorkspaceGanttChart,
  type WorkspaceSearchResult,
  type WorkspaceTagSummary,
  type WriteMarkdownFileInput
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { AliasIndex } from "../shared/links";

const relicApi: RelicApi = {
  applySearchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
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
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getEditorSettings: () =>
    ipcRenderer.invoke(getEditorSettingsChannel) as Promise<RelicResult<EditorSettings>>,
  getWorkspaceAliases: () =>
    ipcRenderer.invoke(getWorkspaceAliasesChannel) as Promise<RelicResult<AliasIndex>>,
  getWorkspaceChronicle: () =>
    ipcRenderer.invoke(getWorkspaceChronicleChannel) as Promise<RelicResult<WorkspaceGanttChart[]>>,
  getWorkspaceChronicleCalendars: () =>
    ipcRenderer.invoke(getWorkspaceChronicleCalendarsChannel) as Promise<RelicResult<ChronicleCalendarSettings[]>>,
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
  writeMarkdownFile: (input: WriteMarkdownFileInput) =>
    ipcRenderer.invoke(writeMarkdownFileChannel, input) as Promise<RelicResult<void>>,
  writeClipboardText: (text: string) => clipboard.writeText(text),
  saveWorkspaceChronicleCalendars: (input: ChronicleCalendarSettings[]) =>
    ipcRenderer.invoke(saveWorkspaceChronicleCalendarsChannel, input) as Promise<RelicResult<ChronicleCalendarSettings[]>>,
  saveWorkspaceGanttCharts: (input: GanttChartSettings[]) =>
    ipcRenderer.invoke(saveWorkspaceGanttChartsChannel, input) as Promise<RelicResult<WorkspaceGanttChart[]>>,
  updateGanttChartEntry: (input: UpdateGanttChartEntryInput) =>
    ipcRenderer.invoke(updateGanttChartEntryChannel, input) as Promise<RelicResult<WorkspaceGanttChart[]>>,
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
  }
};

contextBridge.exposeInMainWorld("relic", relicApi);
