import { create } from "zustand";

import { defaultEditorSettings, type EditorSettings, type MarkdownCardContent } from "../../shared/ipc";
import {
  closeAllTabsInPaneState,
  closeAllTabsState,
  closeOtherTabsState,
  closeTabState,
  closeTabsToRightState,
  emptyPane,
  moveTabState,
  openCardTabState,
  openTimelineTabState,
  openPanelTabState,
  setTabActiveState,
  toggleTabPinnedState,
  toggleSplitState,
  updateCardTabContentState,
  updateCardTabMetaState
} from "./editorStoreModel";

export type PanelTabKind = "tools" | "frontmatter" | "timeline-settings" | "settings";

export interface CardTab {
  content: string;
  id: string;
  isPinned?: boolean;
  kind: "card";
  name: string;
  path: string;
}

export interface PanelTab {
  id: string;
  isPinned?: boolean;
  kind: "panel";
  name: string;
  panel: PanelTabKind;
}

export interface TimelineTab {
  chartId: string;
  id: string;
  isPinned?: boolean;
  kind: "timeline";
  name: string;
}

export type Tab = CardTab | TimelineTab | PanelTab;
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
  openCardInPane: (pane: PaneId, card: MarkdownCardContent) => void;
  openTimelineChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  setEditorSettings: (settings: EditorSettings) => void;
  setFocusedPane: (pane: PaneId) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  toggleTabPinned: (tabId: string) => void;
  toggleSplit: () => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateTabMeta: (tabId: string, meta: Pick<CardTab, "name" | "path">) => void;
  closeAllTabs: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  editorSettings: defaultEditorSettings,
  focusedPane: "left",
  isSplit: false,
  leftPane: emptyPane(),
  rightPane: emptyPane(),
  tabs: {},

  openCardInPane: (pane, card) => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return openCardTabState(state, pane, card, id);
    });
  },

  openPanelInPane: (pane, panel, name) => {
    set((state) => {
      return openPanelTabState(state, pane, panel, name);
    });
  },

  openTimelineChartInPane: (pane, chart) => {
    set((state) => {
      return openTimelineTabState(state, pane, chart);
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
      return updateCardTabContentState(state, tabId, content);
    });
  },

  updateTabMeta: (tabId, meta) => {
    set((state) => {
      return updateCardTabMetaState(state, tabId, meta);
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

  setEditorSettings: (settings) => set({ editorSettings: settings }),

  closeAllTabs: () => {
    set(closeAllTabsState());
  }
}));
