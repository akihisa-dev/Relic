import { create } from "zustand";

import { defaultEditorSettings, type EditorSettings, type MarkdownFileContent } from "../../shared/ipc";
import { flushPendingEditorChanges } from "../editorInputBuffer";
import {
  type ClosedTabEntry,
  rememberClosedTabs,
  reopenClosedTabState
} from "./editorClosedTabHistoryModel";
import {
  moveEditorNavigationState,
  pruneEditorNavigationState,
  recordEditorNavigationState,
  type EditorNavigationEntry
} from "./editorNavigationHistoryModel";
import {
  closeAllTabsInPaneState,
  closeAllTabsState,
  closeOtherTabsState,
  closeTabState,
  closeTabsToRightState,
  emptyPane,
  moveTabState,
  openFileTabState,
  openImageTabState,
  openPdfTabState,
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
import type { PaneId, PaneState, PanelTabKind, Tab } from "./editorStoreTypes";

type WorkspacePathTab = Extract<Tab, { kind: "file" | "image" | "pdf" }>;

export type {
  ChartTab,
  FileTab,
  ImageTab,
  PaneId,
  PaneState,
  PdfTab,
  PanelTab,
  PanelTabKind,
  Tab
} from "./editorStoreTypes";

interface EditorStore {
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
  updateTabContent: (tabId: string, content: string) => void;
  updateTabFromExternal: (tabId: string, content: string) => void;
  updateTabMeta: (tabId: string, meta: Pick<WorkspacePathTab, "name" | "path">) => void;
  closeAllTabs: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  closedTabs: [],
  editorSettings: defaultEditorSettings,
  focusedPane: "left",
  isSplit: false,
  leftPane: emptyPane(),
  navigationHistory: [],
  navigationIndex: -1,
  rightPane: emptyPane(),
  tabs: {},

  openFileInPane: (pane, file) => {
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return recordEditorNavigationState(state, openFileTabState(state, pane, file, id));
    });
  },

  openImageInPane: (pane, image) => {
    const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return recordEditorNavigationState(state, openImageTabState(state, pane, image, id));
    });
  },

  openPdfInPane: (pane, pdf) => {
    const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return recordEditorNavigationState(state, openPdfTabState(state, pane, pdf, id));
    });
  },

  openPanelInPane: (pane, panel, name) => {
    set((state) => {
      return recordEditorNavigationState(state, openPanelTabState(state, pane, panel, name));
    });
  },

  openChartInPane: (pane, chart) => {
    set((state) => {
      return recordEditorNavigationState(state, openChartTabState(state, pane, chart));
    });
  },

  closeTab: (pane, tabId, remember = true) => {
    flushPendingEditorChanges([tabId]);
    set((state) => {
      const closePatch = closeTabState(state, pane, tabId);
      const closedTabs = rememberClosedTabs(state, pane, closePatch, remember);
      return { ...pruneEditorNavigationState(state, closePatch), closedTabs };
    });
  },

  reopenClosedTab: () => {
    flushPendingEditorChanges();
    set((state) => {
      const reopenPatch = reopenClosedTabState(state);
      if (!reopenPatch) return state;
      return { ...recordEditorNavigationState(state, reopenPatch), closedTabs: reopenPatch.closedTabs };
    });
  },

  setTabActive: (pane, tabId) => {
    flushPendingEditorChanges();
    set((state) => {
      return recordEditorNavigationState(state, setTabActiveState(state, pane, tabId));
    });
  },

  navigateBack: () => {
    flushPendingEditorChanges();
    set((state) => moveEditorNavigationState(state, -1));
  },

  navigateForward: () => {
    flushPendingEditorChanges();
    set((state) => moveEditorNavigationState(state, 1));
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
    flushPendingEditorChanges([tabId]);
    set((state) => {
      return updateFileTabMetaState(state, tabId, meta);
    });
  },

  toggleSplit: () => {
    set((state) => {
      return recordEditorNavigationState(state, toggleSplitState(state));
    });
  },

  setFocusedPane: (pane) => {
    set((state) => recordEditorNavigationState(state, { focusedPane: pane }));
  },

  closeOtherTabs: (pane, tabId) => {
    flushPendingEditorChanges();
    set((state) => {
      const closePatch = closeOtherTabsState(state, pane, tabId);
      const closedTabs = rememberClosedTabs(state, pane, closePatch, true);
      return { ...pruneEditorNavigationState(state, closePatch), closedTabs };
    });
  },

  closeTabsToRight: (pane, tabId) => {
    flushPendingEditorChanges();
    set((state) => {
      const closePatch = closeTabsToRightState(state, pane, tabId);
      const closedTabs = rememberClosedTabs(state, pane, closePatch, true);
      return { ...pruneEditorNavigationState(state, closePatch), closedTabs };
    });
  },

  closeAllTabsInPane: (pane) => {
    flushPendingEditorChanges();
    set((state) => {
      const closePatch = closeAllTabsInPaneState(state, pane);
      const closedTabs = rememberClosedTabs(state, pane, closePatch, true);
      return { ...pruneEditorNavigationState(state, closePatch), closedTabs };
    });
  },

  moveTab: (fromPane, toPane, tabId, targetTabId = null, position = "after") => {
    flushPendingEditorChanges([tabId]);
    set((state) => {
      return recordEditorNavigationState(
        state,
        moveTabState(state, fromPane, toPane, tabId, targetTabId, position)
      );
    });
  },

  markTabSaved: (tabId, content) => {
    set((state) => {
      return markFileTabSavedState(state, tabId, content);
    });
  },

  setTabExternalConflict: (tabId, content) => {
    flushPendingEditorChanges([tabId]);
    set((state) => {
      return setFileTabExternalConflictState(state, tabId, content);
    });
  },

  resolveTabExternalConflict: (tabId, choice) => {
    flushPendingEditorChanges([tabId]);
    set((state) => {
      return resolveFileTabExternalConflictState(state, tabId, choice);
    });
  },

  updateTabFromExternal: (tabId, content) => {
    flushPendingEditorChanges([tabId]);
    set((state) => {
      return updateFileTabFromExternalState(state, tabId, content);
    });
  },

  setEditorSettings: (settings) => set({ editorSettings: settings }),

  closeAllTabs: () => {
    flushPendingEditorChanges();
    set({
      ...closeAllTabsState(),
      closedTabs: [],
      navigationHistory: [],
      navigationIndex: -1
    });
  }
}));
