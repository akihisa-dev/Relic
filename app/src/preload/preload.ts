import { contextBridge, ipcRenderer, webUtils } from "electron";

import {
  applySearchAndReplaceChannel,
  applyUnlinkedReferenceChannel,
  copyEditorTextToClipboardChannel,
  readEditorTextFromClipboardChannel,
  createNewWorkspaceChannel,
  copyDiagramSvgChannel,
  type CopyEditorTextToClipboardInput,
  type CopyDiagramSvgInput,
  togglePinChannel,
  createFolderChannel,
  createLinkedMarkdownFileChannel,
  createMarkdownFileChannel,
  duplicateMarkdownFileChannel,
  importImageFileChannel,
  importMarkdownFilesChannel,
  readImageFileChannel,
  readPdfFileChannel,
  getBacklinksChannel,
  getUnlinkedReferencesChannel,
  getAppInfoChannel,
  getEditorSettingsChannel,
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChartsChannel,
  getWorkspaceFrontmatterCategoryChoicesChannel,
  getWorkspaceGraphChannel,
  getLinkUpdateImpactChannel,
  listFileRecoverySnapshotsChannel,
  getWorkspaceTagsChannel,
  getWorkspaceStateChannel,
  refreshWorkspaceChannel,
  workspaceChangedChannel,
  workspaceWatcherStatusChannel,
  windowCloseRequestedChannel,
  windowCloseResponseChannel,
  moveFolderChannel,
  moveItemToTrashChannel,
  moveMarkdownFileChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  readFileRecoverySnapshotChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  renameFolderChannel,
  renameMarkdownFileChannel,
  replaceInFileChannel,
  revealWorkspaceItemChannel,
  startWorkspaceFileDragChannel,
  saveWorkspaceChartsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel,
  updateChartEntryChannel,
  saveEditorSettingsChannel,
  generateTitleListChannel,
  type GenerateTitleListInput,
  generateTableOfContentsChannel,
  type GenerateTableOfContentsInput,
  generateTagIndexChannel,
  type GenerateTagIndexInput,
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
  saveDiagramSvgChannel,
  type SaveDiagramSvgInput,
  savePreviewAsPdfChannel,
  type SavePreviewAsPdfInput,
  type OutputCopyResult,
  type OutputSavedResult,
  type RefreshWorkspaceInput,
  searchAndReplaceChannel,
  searchWorkspaceChannel,
  switchWorkspaceChannel,
  writeMarkdownFileChannel,
  type AppInfo,
  type ApplyUnlinkedReferenceInput,
  type ApplyUnlinkedReferenceResult,
  type CreateFolderInput,
  type CreateLinkedMarkdownFileInput,
  type CreateLinkedMarkdownFileResult,
  type CreateMarkdownFileInput,
  type DuplicateMarkdownFileInput,
  type EditorSettings,
  type Backlink,
  type FrontmatterCategoryChoice,
  type GetBacklinksInput,
  type GetUnlinkedReferencesInput,
  type ImportImageFileInput,
  type ImportImageFileResult,
  type ImportMarkdownFilesInput,
  type ReadImageFileInput,
  type ReadImageFileResult,
  type ReadPdfFileInput,
  type ReadPdfFileResult,
  type ChartSettings,
  type LinkUpdateImpact,
  type LinkUpdateImpactInput,
  type FileRecoveryEntry,
  type FileRecoveryInput,
  type FileRecoverySnapshot,
  type UpdateChartEntryInput,
  type MarkdownFileContent,
  type MoveFolderInput,
  type MoveItemToTrashInput,
  relicApiContractVersion,
  type MoveMarkdownFileInput,
  type RelicApi,
  type ReadMarkdownFileInput,
  type ReadFileRecoverySnapshotInput,
  type RemoveWorkspaceInput,
  type RenameWorkspaceInput,
  type RenameFolderInput,
  type RenameMarkdownFileInput,
  type RenameMarkdownFileResult,
  type ApplySearchAndReplaceResult,
  type ReplaceInFileInput,
  type ReplaceInFileResult,
  type RevealWorkspaceItemInput,
  type SearchAndReplaceInput,
  type SearchAndReplacePreviewResult,
  type SearchWorkspaceInput,
  type StartWorkspaceFileDragInput,
  type SwitchWorkspaceInput,
  type WorkspaceChangedEvent,
  type WorkspaceWatcherStatusEvent,
  type WindowCloseRequestEvent,
  type WindowCloseResponseInput,
  type UnlinkedReferencesResult,
  type WorkspaceState,
  type WorkspaceChart,
  type WorkspaceGraph,
  type WorkspaceSearchResultSet,
  type WorkspaceTagSummary,
  type WriteMarkdownFileInput
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import type { AliasIndex } from "../shared/links";

const relicApi: RelicApi = {
  apiContractVersion: relicApiContractVersion,
  applySearchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(applySearchAndReplaceChannel, input) as Promise<RelicResult<ApplySearchAndReplaceResult>>,
  copyDiagramSvg: (input: CopyDiagramSvgInput) =>
    ipcRenderer.invoke(copyDiagramSvgChannel, input) as Promise<RelicResult<OutputCopyResult>>,
  createNewWorkspace: () =>
    ipcRenderer.invoke(createNewWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>,
  togglePin: (path: string) =>
    ipcRenderer.invoke(togglePinChannel, path) as Promise<RelicResult<WorkspaceState>>,
  createFolder: (input: CreateFolderInput) =>
    ipcRenderer.invoke(createFolderChannel, input) as Promise<RelicResult<WorkspaceState>>,
  importMarkdownFiles: (input: ImportMarkdownFilesInput) =>
    ipcRenderer.invoke(importMarkdownFilesChannel, input) as Promise<RelicResult<WorkspaceState>>,
  importImageFile: (input: ImportImageFileInput) =>
    ipcRenderer.invoke(importImageFileChannel, input) as Promise<RelicResult<ImportImageFileResult>>,
  readImageFile: (input: ReadImageFileInput) =>
    ipcRenderer.invoke(readImageFileChannel, input) as Promise<RelicResult<ReadImageFileResult>>,
  readPdfFile: (input: ReadPdfFileInput) =>
    ipcRenderer.invoke(readPdfFileChannel, input) as Promise<RelicResult<ReadPdfFileResult>>,
  createLinkedMarkdownFile: (input: CreateLinkedMarkdownFileInput) =>
    ipcRenderer.invoke(createLinkedMarkdownFileChannel, input) as Promise<
      RelicResult<CreateLinkedMarkdownFileResult>
    >,
  createMarkdownFile: (input: CreateMarkdownFileInput) =>
    ipcRenderer.invoke(createMarkdownFileChannel, input) as Promise<RelicResult<WorkspaceState>>,
  getDroppedFilePath: (file: File) => webUtils.getPathForFile(file),
  duplicateMarkdownFile: (input: DuplicateMarkdownFileInput) =>
    ipcRenderer.invoke(duplicateMarkdownFileChannel, input) as Promise<
      RelicResult<RenameMarkdownFileResult>
    >,
  getBacklinks: (input: GetBacklinksInput) =>
    ipcRenderer.invoke(getBacklinksChannel, input) as Promise<RelicResult<Backlink[]>>,
  getUnlinkedReferences: (input: GetUnlinkedReferencesInput) =>
    ipcRenderer.invoke(getUnlinkedReferencesChannel, input) as Promise<RelicResult<UnlinkedReferencesResult>>,
  applyUnlinkedReference: (input: ApplyUnlinkedReferenceInput) =>
    ipcRenderer.invoke(applyUnlinkedReferenceChannel, input) as Promise<RelicResult<ApplyUnlinkedReferenceResult>>,
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getEditorSettings: () =>
    ipcRenderer.invoke(getEditorSettingsChannel) as Promise<RelicResult<EditorSettings>>,
  getWorkspaceAliases: () =>
    ipcRenderer.invoke(getWorkspaceAliasesChannel) as Promise<RelicResult<AliasIndex>>,
  getWorkspaceCharts: () =>
    ipcRenderer.invoke(getWorkspaceChartsChannel) as Promise<RelicResult<WorkspaceChart[]>>,
  getWorkspaceFrontmatterCategoryChoices: () =>
    ipcRenderer.invoke(getWorkspaceFrontmatterCategoryChoicesChannel) as Promise<RelicResult<FrontmatterCategoryChoice[]>>,
  getWorkspaceGraph: () =>
    ipcRenderer.invoke(getWorkspaceGraphChannel) as Promise<RelicResult<WorkspaceGraph>>,
  getFrontmatterValueCandidates: () =>
    ipcRenderer.invoke(getFrontmatterValueCandidatesChannel) as Promise<RelicResult<Record<string, string[]>>>,
  getWorkspaceTags: () =>
    ipcRenderer.invoke(getWorkspaceTagsChannel) as Promise<RelicResult<WorkspaceTagSummary[]>>,
  getWorkspaceState: () =>
    ipcRenderer.invoke(getWorkspaceStateChannel) as Promise<RelicResult<WorkspaceState>>,
  refreshWorkspace: (input: RefreshWorkspaceInput) =>
    ipcRenderer.invoke(refreshWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>,
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
  listFileRecoverySnapshots: (input: FileRecoveryInput) =>
    ipcRenderer.invoke(listFileRecoverySnapshotsChannel, input) as Promise<RelicResult<FileRecoveryEntry[]>>,
  readFileRecoverySnapshot: (input: ReadFileRecoverySnapshotInput) =>
    ipcRenderer.invoke(readFileRecoverySnapshotChannel, input) as Promise<RelicResult<FileRecoverySnapshot>>,
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
  startWorkspaceFileDrag: (input: StartWorkspaceFileDragInput) => {
    ipcRenderer.send(startWorkspaceFileDragChannel, input);
  },
  replaceInFile: (input: ReplaceInFileInput) =>
    ipcRenderer.invoke(replaceInFileChannel, input) as Promise<RelicResult<ReplaceInFileResult>>,
  saveDiagramSvg: (input: SaveDiagramSvgInput) =>
    ipcRenderer.invoke(saveDiagramSvgChannel, input) as Promise<RelicResult<OutputSavedResult>>,
  saveEditorSettings: (input: EditorSettings) =>
    ipcRenderer.invoke(saveEditorSettingsChannel, input) as Promise<RelicResult<void>>,
  savePreviewAsPdf: (input: SavePreviewAsPdfInput) =>
    ipcRenderer.invoke(savePreviewAsPdfChannel, input) as Promise<RelicResult<OutputSavedResult>>,
  searchAndReplace: (input: SearchAndReplaceInput) =>
    ipcRenderer.invoke(searchAndReplaceChannel, input) as Promise<
      RelicResult<SearchAndReplacePreviewResult>
    >,
  searchWorkspace: (input: SearchWorkspaceInput) =>
    ipcRenderer.invoke(searchWorkspaceChannel, input) as Promise<
      RelicResult<WorkspaceSearchResultSet>
    >,
  switchWorkspace: (input: SwitchWorkspaceInput) =>
    ipcRenderer.invoke(switchWorkspaceChannel, input) as Promise<RelicResult<WorkspaceState>>,
  writeMarkdownFile: (input: WriteMarkdownFileInput) =>
    ipcRenderer.invoke(writeMarkdownFileChannel, input) as Promise<RelicResult<void>>,
  copyEditorTextToClipboard: (input: CopyEditorTextToClipboardInput) =>
    ipcRenderer.invoke(copyEditorTextToClipboardChannel, input) as Promise<RelicResult<void>>,
  readEditorTextFromClipboard: () =>
    ipcRenderer.invoke(readEditorTextFromClipboardChannel) as Promise<RelicResult<string>>,
  saveWorkspaceFrontmatterCategoryChoices: (input: FrontmatterCategoryChoice[]) =>
    ipcRenderer.invoke(saveWorkspaceFrontmatterCategoryChoicesChannel, input) as Promise<RelicResult<FrontmatterCategoryChoice[]>>,
  saveWorkspaceCharts: (input: ChartSettings[]) =>
    ipcRenderer.invoke(saveWorkspaceChartsChannel, input) as Promise<RelicResult<WorkspaceChart[]>>,
  updateChartEntry: (input: UpdateChartEntryInput) =>
    ipcRenderer.invoke(updateChartEntryChannel, input) as Promise<RelicResult<WorkspaceChart[]>>,
  generateTitleList: (input: GenerateTitleListInput) =>
    ipcRenderer.invoke(generateTitleListChannel, input) as Promise<RelicResult<string>>,
  generateTableOfContents: (input: GenerateTableOfContentsInput) =>
    ipcRenderer.invoke(generateTableOfContentsChannel, input) as Promise<RelicResult<string>>,
  generateTagIndex: (input: GenerateTagIndexInput) =>
    ipcRenderer.invoke(generateTagIndexChannel, input) as Promise<RelicResult<string>>,
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
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceChangedEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(workspaceChangedChannel, listener);
    return () => ipcRenderer.removeListener(workspaceChangedChannel, listener);
  },
  onWorkspaceWatcherStatus: (callback: (event: WorkspaceWatcherStatusEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: WorkspaceWatcherStatusEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(workspaceWatcherStatusChannel, listener);
    return () => ipcRenderer.removeListener(workspaceWatcherStatusChannel, listener);
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
