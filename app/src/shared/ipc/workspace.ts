import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const createNewWorkspaceChannel = "workspace:createNew";
export const togglePinChannel = "workspace:togglePin";
export const getWorkspaceStateChannel = "workspace:getState";
export const refreshWorkspaceChannel = "workspace:refresh";
export const workspaceChangedChannel = "workspace:changed";
export const workspaceWatcherStatusChannel = "workspace:watcherStatus";
export const openWorkspaceChannel = "workspace:open";
export const removeWorkspaceChannel = "workspace:remove";
export const renameWorkspaceChannel = "workspace:rename";
export const switchWorkspaceChannel = "workspace:switch";
export const getWorkspaceChartsChannel = "workspace:getCharts";
export const getWorkspaceCardsChannel = "workspace:getCards";
export const getWorkspaceFrontmatterCategoryChoicesChannel = "workspace:getFrontmatterCategoryChoices";
export const saveWorkspaceFrontmatterCategoryChoicesChannel = "workspace:saveFrontmatterCategoryChoices";
export const saveWorkspaceChartsChannel = "workspace:saveCharts";
export const updateChartEntryChannel = "workspace:updateChartEntry";

export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
}

export type WorkspaceFileKind = "markdown";
export type WorkspaceTreeFileKind = "image" | "markdown" | "pdf";
export type WorkspaceFileReadStatus = "ok" | "unreadable";

export interface WorkspaceFileIndexEntry {
  kind: WorkspaceFileKind;
  mtimeMs: number;
  name: string;
  path: string;
  readStatus: WorkspaceFileReadStatus;
  size: number;
}

export type WorkspaceTreeNode = WorkspaceFolderNode | WorkspaceFileNode;

export interface WorkspaceFolderNode {
  children: WorkspaceTreeNode[];
  name: string;
  path: string;
  type: "folder";
}

export interface WorkspaceFileNode {
  kind?: WorkspaceTreeFileKind;
  name: string;
  path: string;
  type: "file";
}

export interface WorkspaceState {
  activeWorkspace: WorkspaceSummary | null;
  fileTree: WorkspaceTreeNode[];
  fileIndex?: WorkspaceFileIndexEntry[];
  pinnedPaths: string[];
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceChangedEvent {
  changedAt: string;
  workspaceId: string;
}

export interface WorkspaceWatcherStatusEvent {
  changedAt: string;
  status: "unavailable";
  workspaceId: string;
}

export interface SwitchWorkspaceInput {
  workspaceId: string;
}

export interface RefreshWorkspaceInput {
  workspaceId: string;
}

export interface RemoveWorkspaceInput {
  workspaceId: string;
}

export interface RenameWorkspaceInput {
  name: string;
  workspaceId: string;
}

export type ChartSource = "chronicle";

export type FrontmatterCategoryChoice = string;

export interface ChroniclePoint {
  month: number | null;
  year: number;
}

export interface ChartSettings {
  filePaths?: string[];
  id: string;
  name: string;
  source: ChartSource;
}

export interface ChartEntry {
  category?: string;
  chronicleEntryIndex: number;
  endLabel: string;
  endValue: number;
  fileName: string;
  path: string;
  startPoint: ChroniclePoint;
  endPoint: ChroniclePoint;
  startLabel: string;
  startValue: number;
}

export interface WorkspaceChart extends ChartSettings {
  entries: ChartEntry[];
}

export interface WorkspaceCard {
  imagePath: string;
  name: string;
  path: string;
}

export type ChartEntryEditKind = "move" | "resize-start" | "resize-end";

export interface UpdateChartEntryInput {
  endValue: number;
  kind: ChartEntryEditKind;
  chronicleEntryIndex: number;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: ChartSource;
  startValue: number;
}

export interface WorkspaceApi {
  createNewWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  togglePin: (path: string) => Promise<RelicResult<WorkspaceState>>;
  getWorkspaceState: () => Promise<RelicResult<WorkspaceState>>;
  refreshWorkspace: (input: RefreshWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  openWorkspace: () => Promise<RelicResult<WorkspaceState>>;
  removeWorkspace: (input: RemoveWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  renameWorkspace: (input: RenameWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  switchWorkspace: (input: SwitchWorkspaceInput) => Promise<RelicResult<WorkspaceState>>;
  getWorkspaceCharts: () => Promise<RelicResult<WorkspaceChart[]>>;
  getWorkspaceCards: () => Promise<RelicResult<WorkspaceCard[]>>;
  getWorkspaceFrontmatterCategoryChoices: () => Promise<RelicResult<FrontmatterCategoryChoice[]>>;
  saveWorkspaceFrontmatterCategoryChoices: (input: FrontmatterCategoryChoice[]) => Promise<RelicResult<FrontmatterCategoryChoice[]>>;
  saveWorkspaceCharts: (input: ChartSettings[]) => Promise<RelicResult<WorkspaceChart[]>>;
  updateChartEntry: (input: UpdateChartEntryInput) => Promise<RelicResult<WorkspaceChart[]>>;
  onWorkspaceChanged: (callback: (event: WorkspaceChangedEvent) => void) => () => void;
  onWorkspaceWatcherStatus: (callback: (event: WorkspaceWatcherStatusEvent) => void) => () => void;
}

export const workspaceIpcContract = {
  createNewWorkspace: { channel: createNewWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: false },
  togglePin: { channel: togglePinChannel, main: "handle", transport: "invoke", validatesInput: true },
  getWorkspaceState: { channel: getWorkspaceStateChannel, main: "handle", transport: "invoke", validatesInput: false },
  refreshWorkspace: { channel: refreshWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: true },
  openWorkspace: { channel: openWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: false },
  removeWorkspace: { channel: removeWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: true },
  renameWorkspace: { channel: renameWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: true },
  switchWorkspace: { channel: switchWorkspaceChannel, main: "handle", transport: "invoke", validatesInput: true },
  getWorkspaceCharts: { channel: getWorkspaceChartsChannel, main: "handle", transport: "invoke", validatesInput: false },
  getWorkspaceCards: { channel: getWorkspaceCardsChannel, main: "handle", transport: "invoke", validatesInput: false },
  getWorkspaceFrontmatterCategoryChoices: { channel: getWorkspaceFrontmatterCategoryChoicesChannel, main: "handle", transport: "invoke", validatesInput: false },
  saveWorkspaceFrontmatterCategoryChoices: { channel: saveWorkspaceFrontmatterCategoryChoicesChannel, main: "handle", transport: "invoke", validatesInput: true },
  saveWorkspaceCharts: { channel: saveWorkspaceChartsChannel, main: "handle", transport: "invoke", validatesInput: true },
  updateChartEntry: { channel: updateChartEntryChannel, main: "handle", transport: "invoke", validatesInput: true },
  onWorkspaceChanged: { channel: workspaceChangedChannel, main: "sender", transport: "subscribe", validatesInput: false },
  onWorkspaceWatcherStatus: { channel: workspaceWatcherStatusChannel, main: "sender", transport: "subscribe", validatesInput: false }
} as const satisfies IpcFeatureContract;
