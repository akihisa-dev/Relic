import { create } from "zustand";

import { defaultEditorSettings, type EditorSettings, type MarkdownFileContent } from "../../shared/ipc";

export type PanelTabKind = "git" | "tools" | "frontmatter" | "chronicle" | "settings";

export interface FileTab {
  content: string;
  id: string;
  kind: "file";
  name: string;
  path: string;
}

export interface PanelTab {
  id: string;
  kind: "panel";
  name: string;
  panel: PanelTabKind;
}

export type Tab = FileTab | PanelTab;
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
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  setEditorSettings: (settings: EditorSettings) => void;
  setFocusedPane: (pane: PaneId) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  toggleSplit: () => void;
  updateTabContent: (tabId: string, content: string) => void;
  updateTabMeta: (tabId: string, meta: Pick<FileTab, "name" | "path">) => void;
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
    const existing = Object.values(tabs).find((t) => t.kind === "file" && t.path === file.path);

    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const paneState = state[paneKey];

      if (existing) {
        return {
          focusedPane: pane,
          [paneKey]: activateTab(ensureTabInPane(paneState, existing.id), existing.id)
        };
      }

      const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newTab: FileTab = { content: file.content, id, kind: "file", name: file.name, path: file.path };

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

  openPanelInPane: (pane, panel, name) => {
    const id = `panel-${panel}`;

    set((state) => {
      const paneKey = pane === "left" ? "leftPane" : "rightPane";
      const paneState = state[paneKey];
      const existing = state.tabs[id];
      const nextTabs = existing
        ? state.tabs
        : { ...state.tabs, [id]: { id, kind: "panel" as const, name, panel } };

      return {
        focusedPane: pane,
        tabs: nextTabs,
        [paneKey]: activateTab(ensureTabInPane(paneState, id), id)
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
      if (state.tabs[tabId]?.kind !== "file") return state;

      return { tabs: { ...state.tabs, [tabId]: { ...state.tabs[tabId], content } } };
    });
  },

  updateTabMeta: (tabId, meta) => {
    set((state) => {
      if (state.tabs[tabId]?.kind !== "file") return state;

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

      const activeTabId = state.leftPane.activeTabId;

      if (!activeTabId) return { isSplit: true };

      return {
        isSplit: true,
        rightPane: {
          activeTabId,
          history: [activeTabId],
          tabIds: [activeTabId]
        }
      };
    });
  },

  setFocusedPane: (pane) => set({ focusedPane: pane }),

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

  moveTab: (fromPane, toPane, tabId, targetTabId = null, position = "after") => {
    set((state) => {
      if (!state.tabs[tabId]) return state;

      const fromKey = fromPane === "left" ? "leftPane" : "rightPane";
      const toKey = toPane === "left" ? "leftPane" : "rightPane";
      const fromState = state[fromKey];
      const toState = state[toKey];

      if (!fromState.tabIds.includes(tabId) && !toState.tabIds.includes(tabId)) return state;

      const nextFromIds = fromState.tabIds.filter((id) => id !== tabId);
      const baseToIds = fromPane === toPane
        ? nextFromIds
        : toState.tabIds.filter((id) => id !== tabId);
      const targetIndex = targetTabId ? baseToIds.indexOf(targetTabId) : -1;
      const insertIndex = targetIndex === -1
        ? baseToIds.length
        : position === "before"
          ? targetIndex
          : targetIndex + 1;
      const nextToIds = [
        ...baseToIds.slice(0, insertIndex),
        tabId,
        ...baseToIds.slice(insertIndex)
      ];

      const nextFromHistory = fromState.history.filter((id) => id !== tabId);
      const nextFromActive = fromState.activeTabId === tabId
        ? nextFromHistory.at(-1) ?? nextFromIds.at(-1) ?? null
        : fromState.activeTabId;
      const nextToHistory = [...toState.history.filter((id) => id !== tabId), tabId]
        .filter((id) => nextToIds.includes(id));

      if (fromPane === toPane) {
        return {
          focusedPane: toPane,
          [toKey]: {
            activeTabId: tabId,
            history: [...fromState.history.filter((id) => id !== tabId), tabId],
            tabIds: nextToIds
          }
        };
      }

      return {
        focusedPane: toPane,
        [fromKey]: {
          activeTabId: nextFromActive,
          history: nextFromHistory,
          tabIds: nextFromIds
        },
        [toKey]: {
          activeTabId: tabId,
          history: nextToHistory,
          tabIds: nextToIds
        }
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

function ensureTabInPane(pane: PaneState, tabId: string): PaneState {
  if (pane.tabIds.includes(tabId)) return pane;

  return {
    ...pane,
    tabIds: [...pane.tabIds, tabId]
  };
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];

  return next;
}
