import type { EditorSettings, MarkdownFileContent } from "../../shared/ipc";
import type { FileTab, GanttTab, PaneId, PaneState, PanelTab, PanelTabKind, Tab } from "./editorStore";

export interface EditorStoreModelState {
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  isSplit: boolean;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}

export function emptyPane(): PaneState {
  return { activeTabId: null, history: [], tabIds: [] };
}

export function openFileTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  file: MarkdownFileContent,
  id: string
): Partial<EditorStoreModelState> {
  const existing = Object.values(state.tabs).find((tab) => tab.kind === "file" && tab.path === file.path);
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];

  if (existing) {
    return {
      focusedPane: pane,
      [paneKey]: activateTab(ensureTabInPane(paneState, existing.id), existing.id)
    };
  }

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
}

export function openPanelTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  panel: PanelTabKind,
  name: string
): Partial<EditorStoreModelState> {
  const id = `panel-${panel}`;
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];
  const existing = state.tabs[id];
  const nextTabs = existing
    ? state.tabs
    : { ...state.tabs, [id]: { id, kind: "panel" as const, name, panel } satisfies PanelTab };

  return {
    focusedPane: pane,
    tabs: nextTabs,
    [paneKey]: activateTab(ensureTabInPane(paneState, id), id)
  };
}

export function openGanttTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  chart: { id: string; name: string }
): Partial<EditorStoreModelState> {
  const id = `gantt-${chart.id}`;
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];
  const existing = state.tabs[id];
  const nextTabs = existing
    ? { ...state.tabs, [id]: { ...existing, name: chart.name } }
    : { ...state.tabs, [id]: { chartId: chart.id, id, kind: "gantt" as const, name: chart.name } satisfies GanttTab };

  return {
    focusedPane: pane,
    tabs: nextTabs,
    [paneKey]: activateTab(ensureTabInPane(paneState, id), id)
  };
}

export function closeTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  tabId: string
): Partial<EditorStoreModelState> {
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];
  const nextTabIds = paneState.tabIds.filter((id) => id !== tabId);
  const nextHistory = paneState.history.filter((id) => id !== tabId);

  let nextActiveTabId: string | null = paneState.activeTabId;

  if (paneState.activeTabId === tabId) {
    const historyWithout = paneState.history.filter((id) => id !== tabId);
    nextActiveTabId = historyWithout.at(-1) ?? nextTabIds.at(-1) ?? null;
  }

  const otherPane = state[otherPaneKeyFor(pane)];
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
}

export function setTabActiveState(
  state: EditorStoreModelState,
  pane: PaneId,
  tabId: string
): Partial<EditorStoreModelState> {
  const paneKey = paneKeyFor(pane);

  return {
    focusedPane: pane,
    [paneKey]: activateTab(state[paneKey], tabId)
  };
}

export function updateFileTabContentState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return { tabs: { ...state.tabs, [tabId]: { ...tab, content } } };
}

export function updateFileTabMetaState(
  state: EditorStoreModelState,
  tabId: string,
  meta: Pick<FileTab, "name" | "path">
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return { tabs: { ...state.tabs, [tabId]: { ...tab, ...meta } } };
}

export function toggleSplitState(state: EditorStoreModelState): Partial<EditorStoreModelState> {
  if (state.isSplit) {
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
}

export function closeOtherTabsState(
  state: EditorStoreModelState,
  pane: PaneId,
  tabId: string
): Partial<EditorStoreModelState> {
  const paneKey = paneKeyFor(pane);
  const otherPane = state[otherPaneKeyFor(pane)];

  const removedIds = state[paneKey].tabIds.filter(
    (id) => id !== tabId && !otherPane.tabIds.includes(id)
  );
  const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs);

  return {
    tabs: nextTabs,
    [paneKey]: {
      activeTabId: tabId,
      history: [tabId],
      tabIds: [tabId]
    }
  };
}

export function closeTabsToRightState(
  state: EditorStoreModelState,
  pane: PaneId,
  tabId: string
): Partial<EditorStoreModelState> {
  const paneKey = paneKeyFor(pane);
  const otherPane = state[otherPaneKeyFor(pane)];
  const paneState = state[paneKey];

  const idx = paneState.tabIds.indexOf(tabId);
  const nextTabIds = idx === -1 ? paneState.tabIds : paneState.tabIds.slice(0, idx + 1);
  const removedIds = paneState.tabIds.slice(idx + 1).filter((id) => !otherPane.tabIds.includes(id));
  const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs);

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
}

export function closeAllTabsInPaneState(
  state: EditorStoreModelState,
  pane: PaneId
): Partial<EditorStoreModelState> {
  const paneKey = paneKeyFor(pane);
  const otherPane = state[otherPaneKeyFor(pane)];

  const removedIds = state[paneKey].tabIds.filter((id) => !otherPane.tabIds.includes(id));
  const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs);

  return {
    tabs: nextTabs,
    [paneKey]: emptyPane()
  };
}

export function moveTabState(
  state: EditorStoreModelState,
  fromPane: PaneId,
  toPane: PaneId,
  tabId: string,
  targetTabId: string | null = null,
  position: "before" | "after" = "after"
): Partial<EditorStoreModelState> | EditorStoreModelState {
  if (!state.tabs[tabId]) return state;

  const fromKey = paneKeyFor(fromPane);
  const toKey = paneKeyFor(toPane);
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
}

export function closeAllTabsState(): Pick<EditorStoreModelState, "leftPane" | "rightPane" | "tabs"> {
  return { tabs: {}, leftPane: emptyPane(), rightPane: emptyPane() };
}

export function activateTab(pane: PaneState, tabId: string): PaneState {
  return {
    ...pane,
    activeTabId: tabId,
    history: [...pane.history.filter((id) => id !== tabId), tabId]
  };
}

export function ensureTabInPane(pane: PaneState, tabId: string): PaneState {
  if (pane.tabIds.includes(tabId)) return pane;

  return {
    ...pane,
    tabIds: [...pane.tabIds, tabId]
  };
}

function paneKeyFor(pane: PaneId): "leftPane" | "rightPane" {
  return pane === "left" ? "leftPane" : "rightPane";
}

function otherPaneKeyFor(pane: PaneId): "leftPane" | "rightPane" {
  return pane === "left" ? "rightPane" : "leftPane";
}

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj };
  delete next[key];

  return next;
}
