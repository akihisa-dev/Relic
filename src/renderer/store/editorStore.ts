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
        // 分割解除：右ペインのタブを閉じる（左ペインに残す）
        return {
          isSplit: false,
          rightPane: emptyPane(),
          focusedPane: "left"
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
