import { create } from "zustand";

import { defaultEditorSettings, type EditorSettings, type MarkdownFileContent } from "../../shared/ipc";

export type ViewMode = "source" | "preview";

export interface Tab {
  content: string;
  id: string;
  name: string;
  path: string;
  viewMode: ViewMode;
}

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
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  setEditorSettings: (settings: EditorSettings) => void;
  setFocusedPane: (pane: PaneId) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  setTabViewMode: (tabId: string, mode: ViewMode) => void;
  toggleSplit: () => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateTabMeta: (tabId: string, meta: Pick<Tab, "name" | "path">) => void;
  closeAllTabs: () => void;
}

const emptyPane = (): PaneState => ({ activeTabId: null, history: [], tabIds: [] });

export const useEditorStore = create<EditorStore>((set, get) => ({
  editorSettings: defaultEditorSettings,
  focusedPane: "left",
  isSplit: false,
  leftPane: emptyPane(),
  rightPane: emptyPane(),
  tabs: {},

  openFileInPane: (pane, file) => {
    const { tabs } = get();

    // すでに同じパスのタブが開いている場合はそちらをアクティブにする
    const existing = Object.values(tabs).find((t) => t.path === file.path);

    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const paneState = state[paneKey];

      if (existing) {
        return {
          focusedPane: pane,
          [paneKey]: activateTab(paneState, existing.id)
        };
      }

      const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newTab: Tab = { content: file.content, id, name: file.name, path: file.path, viewMode: "preview" };

      return {
        focusedPane: pane,
        tabs: { ...state.tabs, [id]: newTab },
        [paneKey]: {
          activeTabId: id,
          history: [...paneState.history, id],
          tabIds: [...paneState.tabIds, id]
        }
      };
    });
  },

  closeTab: (pane, tabId) => {
    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const paneState = state[paneKey];
      const nextTabIds = paneState.tabIds.filter((id) => id !== tabId);
      const nextHistory = paneState.history.filter((id) => id !== tabId);

      // 閉じたタブがアクティブだった場合、履歴の直前タブをアクティブにする
      let nextActiveTabId: string | null = paneState.activeTabId;

      if (paneState.activeTabId === tabId) {
        const historyWithout = paneState.history.filter((id) => id !== tabId);
        nextActiveTabId = historyWithout.at(-1) ?? nextTabIds.at(-1) ?? null;
      }

      // タブが他のペインでも使われていない場合は tabs から削除
      const otherPaneKey = pane === "left" ? "rightPane" : "leftPane";
      const otherPane = state[otherPaneKey];
      const usedElsewhere = otherPane.tabIds.includes(tabId);
      const nextTabs = usedElsewhere ? state.tabs : omit(state.tabs, tabId);

      return {
        tabs: nextTabs,
        [paneKey]: {
          activeTabId: nextActiveTabId,
          history: nextHistory,
          tabIds: nextTabIds
        }
      };
    });
  },

  setTabActive: (pane, tabId) => {
    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";

      return {
        focusedPane: pane,
        [paneKey]: activateTab(state[paneKey], tabId)
      };
    });
  },

  updateTabContent: (tabId, content) => {
    set((state) => {
      if (!state.tabs[tabId]) return state;

      return { tabs: { ...state.tabs, [tabId]: { ...state.tabs[tabId], content } } };
    });
  },

  updateTabMeta: (tabId, meta) => {
    set((state) => {
      if (!state.tabs[tabId]) return state;

      return { tabs: { ...state.tabs, [tabId]: { ...state.tabs[tabId], ...meta } } };
    });
  },

  toggleSplit: () => {
    set((state) => {
      if (state.isSplit) {
        // 分割解除：右ペインのタブを左ペインに移す
        const rightTabIds = state.rightPane.tabIds.filter(
          (id) => !state.leftPane.tabIds.includes(id)
        );
        const mergedTabIds = [...state.leftPane.tabIds, ...rightTabIds];
        const lastRightActiveId = state.rightPane.activeTabId;
        const newActiveId =
          lastRightActiveId && !state.leftPane.tabIds.includes(lastRightActiveId)
            ? lastRightActiveId
            : state.leftPane.activeTabId;

        return {
          isSplit: false,
          focusedPane: "left",
          leftPane: {
            activeTabId: newActiveId,
            history: [...state.leftPane.history, ...state.rightPane.history],
            tabIds: mergedTabIds
          },
          rightPane: emptyPane()
        };
      }

      return { isSplit: true };
    });
  },

  setFocusedPane: (pane) => set({ focusedPane: pane }),

  setTabViewMode: (tabId, mode) => {
    set((state) => {
      if (!state.tabs[tabId]) return state;

      return { tabs: { ...state.tabs, [tabId]: { ...state.tabs[tabId], viewMode: mode } } };
    });
  },

  closeOtherTabs: (pane, tabId) => {
    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const otherPaneKey = pane === "left" ? "rightPane" : "leftPane";
      const otherPane = state[otherPaneKey];

      // Remove tabs not equal to tabId that aren't used in the other pane
      const removedIds = state[paneKey].tabIds.filter(
        (id) => id !== tabId && !otherPane.tabIds.includes(id)
      );
      const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs as Record<string, unknown>) as typeof state.tabs;

      return {
        tabs: nextTabs,
        [paneKey]: {
          activeTabId: tabId,
          history: [tabId],
          tabIds: [tabId]
        }
      };
    });
  },

  closeTabsToRight: (pane, tabId) => {
    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const otherPaneKey = pane === "left" ? "rightPane" : "leftPane";
      const otherPane = state[otherPaneKey];
      const paneState = state[paneKey];

      const idx = paneState.tabIds.indexOf(tabId);
      const nextTabIds = idx === -1 ? paneState.tabIds : paneState.tabIds.slice(0, idx + 1);
      const removedIds = paneState.tabIds.slice(idx + 1).filter((id) => !otherPane.tabIds.includes(id));
      const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs as Record<string, unknown>) as typeof state.tabs;

      const activeWasRemoved = paneState.activeTabId !== null && !nextTabIds.includes(paneState.activeTabId);
      const nextActiveTabId = activeWasRemoved ? tabId : paneState.activeTabId;
      const nextHistory = paneState.history.filter((id) => nextTabIds.includes(id));

      return {
        tabs: nextTabs,
        [paneKey]: {
          activeTabId: nextActiveTabId,
          history: nextHistory,
          tabIds: nextTabIds
        }
      };
    });
  },

  closeAllTabsInPane: (pane) => {
    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const otherPaneKey = pane === "left" ? "rightPane" : "leftPane";
      const otherPane = state[otherPaneKey];

      const removedIds = state[paneKey].tabIds.filter((id) => !otherPane.tabIds.includes(id));
      const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs as Record<string, unknown>) as typeof state.tabs;

      return {
        tabs: nextTabs,
        [paneKey]: emptyPane()
      };
    });
  },

  setEditorSettings: (settings) => set({ editorSettings: settings }),

  closeAllTabs: () => {
    set({ tabs: {}, leftPane: emptyPane(), rightPane: emptyPane() });
  }
}));

function activateTab(pane: PaneState, tabId: string): PaneState {
  return {
    ...pane,
    activeTabId: tabId,
    history: [...pane.history.filter((id) => id !== tabId), tabId]
  };
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];

  return next;
}
