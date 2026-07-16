import { create } from "zustand";

import { defaultEditorSettings, type EditorSettings, type MarkdownFileContent } from "../../shared/ipc";
import { flushPendingEditorChanges } from "../editorInputBuffer";
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
import type { FileTab, PaneId, PaneState, PanelTabKind, Tab } from "./editorStoreTypes";

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
  openImageInPane: (pane: PaneId, image: { name: string; path: string }) => void;
  openPdfInPane: (pane: PaneId, pdf: { name: string; path: string }) => void;
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

  openImageInPane: (pane, image) => {
    const id = `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return openImageTabState(state, pane, image, id);
    });
  },

  openPdfInPane: (pane, pdf) => {
    const id = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      return openPdfTabState(state, pane, pdf, id);
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
    flushPendingEditorChanges([tabId]);
    set((state) => {
      return closeTabState(state, pane, tabId);
    });
  },

  setTabActive: (pane, tabId) => {
    flushPendingEditorChanges();
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
    flushPendingEditorChanges([tabId]);
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
    flushPendingEditorChanges();
    set((state) => {
      return closeOtherTabsState(state, pane, tabId);
    });
  },

  closeTabsToRight: (pane, tabId) => {
    flushPendingEditorChanges();
    set((state) => {
      return closeTabsToRightState(state, pane, tabId);
    });
  },

  closeAllTabsInPane: (pane) => {
    flushPendingEditorChanges();
    set((state) => {
      return closeAllTabsInPaneState(state, pane);
    });
  },

  moveTab: (fromPane, toPane, tabId, targetTabId = null, position = "after") => {
    flushPendingEditorChanges([tabId]);
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
    set(closeAllTabsState());
  }
}));
