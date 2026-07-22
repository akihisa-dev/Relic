import type { StoreApi } from "zustand";

import type { EditorSettings, MarkdownFileContent } from "../../shared/ipc";
import type { EditorContentUpdateInput } from "../editorContentUpdate";
import type { ClosedTabEntry } from "./editorClosedTabHistoryModel";
import type { EditorNavigationEntry } from "./editorNavigationHistoryModel";
import type { PaneId, PaneState, PanelTabKind, Tab } from "./editorStoreTypes";

type WorkspacePathTab = Extract<Tab, { kind: "file" | "image" | "pdf" }>;

export interface EditorStore {
  editorSettings: EditorSettings;
  closedTabs: ClosedTabEntry[];
  focusedPane: PaneId;
  isSplit: boolean;
  leftPane: PaneState;
  navigationHistory: EditorNavigationEntry[];
  navigationIndex: number;
  rightPane: PaneState;
  tabs: Record<string, Tab>;

  closeTab: (pane: PaneId, tabId: string, remember?: boolean) => void;
  closeOtherTabs: (pane: PaneId, tabId: string) => void;
  closeTabsToRight: (pane: PaneId, tabId: string) => void;
  closeAllTabsInPane: (pane: PaneId) => void;
  moveTab: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  markTabSaved: (tabId: string, content: string) => void;
  markTabSavedCheckpoint: (tabId: string, content: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  openImageInPane: (pane: PaneId, image: { name: string; path: string }) => void;
  openPdfInPane: (pane: PaneId, pdf: { name: string; path: string }) => void;
  openChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  reopenClosedTab: () => void;
  resolveTabExternalConflict: (tabId: string, choice: "external" | "relic") => void;
  setTabExternalConflict: (tabId: string, content: string) => void;
  setEditorSettings: (settings: EditorSettings) => void;
  setFocusedPane: (pane: PaneId) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  toggleTabPinned: (tabId: string) => void;
  toggleSplit: () => void;
  updateTabContent: (tabId: string, content: string, update?: EditorContentUpdateInput) => void;
  updateTabFromExternal: (tabId: string, content: string) => void;
  updateTabMeta: (tabId: string, meta: Pick<WorkspacePathTab, "name" | "path">) => void;
  closeAllTabs: () => void;
}

export type EditorStoreSet = StoreApi<EditorStore>["setState"];
export type EditorStoreActions = Omit<EditorStore,
  | "closedTabs"
  | "editorSettings"
  | "focusedPane"
  | "isSplit"
  | "leftPane"
  | "navigationHistory"
  | "navigationIndex"
  | "rightPane"
  | "tabs"
>;
