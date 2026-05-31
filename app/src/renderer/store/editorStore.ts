import { create } from "zustand";

import { defaultEditorSettings, type EditorSettings, type MarkdownFileContent } from "../../shared/ipc";
import {
  closeAllTabsInPaneState,
  closeAllTabsState,
  closeOtherTabsState,
  closeTabState,
  closeTabsToRightState,
  emptyPane,
  moveTabState,
  openFileTabState,
  markFileTabSavedState,
  openChartTabState,
  openPanelTabState,
  resolveFileTabExternalConflictState,
  setTabActiveState,
  setFileTabExternalConflictState,
  toggleTabPinnedState,
  toggleSplitState,
  updateFileTabContentState,
  updateFileTabFromExternalState,
  updateFileTabMetaState
} from "./editorStoreModel";

export type PanelTabKind = "tools" | "frontmatter" | "chronicleSettings" | "settings";

export interface FileTab {
  content: string;
  externalConflict?: {
    content: string;
  };
  id: string;
  isPinned?: boolean;
  kind: "file";
  name: string;
  path: string;
  savedContent: string;
}

export interface PanelTab {
  id: string;
  isPinned?: boolean;
  kind: "panel";
  name: string;
  panel: PanelTabKind;
}

export interface ChartTab {
  chartId: string;
  id: string;
  isPinned?: boolean;
  kind: "chart";
  name: string;
}

export type Tab = FileTab | ChartTab | PanelTab;
export type PaneId = "left" | "right";

export interface PaneState {
  activeTabId: string | null;
  history: string[];
  tabIds: string[];
}

interface EditorStore {
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  isSplit: boolean;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;

  closeTab: (pane: PaneId, tabId: string) => void;
  closeOtherTabs: (pane: PaneId, tabId: string) => void;
  closeTabsToRight: (pane: PaneId, tabId: string) => void;
  closeAllTabsInPane: (pane: PaneId) => void;
  moveTab: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  markTabSaved: (tabId: string, content: string) => void;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  openChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  resolveTabExternalConflict: (tabId: string, choice: "external" | "relic") => void;
  setTabExternalConflict: (tabId: string, content: string) => void;
  setEditorSettings: (settings: EditorSettings) => void;
  setFocusedPane: (pane: PaneId) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  toggleTabPinned: (tabId: string) => void;
  toggleSplit: () => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateTabFromExternal: (tabId: string, content: string) => void;
  updateTabMeta: (tabId: string, meta: Pick<FileTab, "name" | "path">) => void;
  closeAllTabs: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  editorSettings: defaultEditorSettings,
  focusedPane: "left",
  isSplit: false,
  leftPane: emptyPane(),
  rightPane: emptyPane(),
  tabs: {},

  openFileInPane: (pane, file) => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return openFileTabState(state, pane, file, id);
    });
  },

  openPanelInPane: (pane, panel, name) => {
    set((state) => {
      return openPanelTabState(state, pane, panel, name);
    });
  },

  openChartInPane: (pane, chart) => {
    set((state) => {
      return openChartTabState(state, pane, chart);
    });
  },

  closeTab: (pane, tabId) => {
    set((state) => {
      return closeTabState(state, pane, tabId);
    });
  },

  setTabActive: (pane, tabId) => {
    set((state) => {
      return setTabActiveState(state, pane, tabId);
    });
  },

  toggleTabPinned: (tabId) => {
    set((state) => {
      return toggleTabPinnedState(state, tabId);
    });
  },

  updateTabContent: (tabId, content) => {
    set((state) => {
      return updateFileTabContentState(state, tabId, content);
    });
  },

  updateTabMeta: (tabId, meta) => {
    set((state) => {
      return updateFileTabMetaState(state, tabId, meta);
    });
  },

  toggleSplit: () => {
    set((state) => {
      return toggleSplitState(state);
    });
  },

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  closeOtherTabs: (pane, tabId) => {
    set((state) => {
      return closeOtherTabsState(state, pane, tabId);
    });
  },

  closeTabsToRight: (pane, tabId) => {
    set((state) => {
      return closeTabsToRightState(state, pane, tabId);
    });
  },

  closeAllTabsInPane: (pane) => {
    set((state) => {
      return closeAllTabsInPaneState(state, pane);
    });
  },

  moveTab: (fromPane, toPane, tabId, targetTabId = null, position = "after") => {
    set((state) => {
      return moveTabState(state, fromPane, toPane, tabId, targetTabId, position);
    });
  },

  markTabSaved: (tabId, content) => {
    set((state) => {
      return markFileTabSavedState(state, tabId, content);
    });
  },

  setTabExternalConflict: (tabId, content) => {
    set((state) => {
      return setFileTabExternalConflictState(state, tabId, content);
    });
  },

  resolveTabExternalConflict: (tabId, choice) => {
    set((state) => {
      return resolveFileTabExternalConflictState(state, tabId, choice);
    });
  },

  updateTabFromExternal: (tabId, content) => {
    set((state) => {
      return updateFileTabFromExternalState(state, tabId, content);
    });
  },

  setEditorSettings: (settings) => set({ editorSettings: settings }),

  closeAllTabs: () => {
    set(closeAllTabsState());
  }
}));
