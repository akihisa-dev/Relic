import type { EditorSettings, MarkdownFileContent } from "../../shared/ipc";
import type { FileTab, ChartTab, PaneId, PaneState, PanelTab, PanelTabKind, Tab } from "./editorStore";

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
    const nextPane = activateTab(insertTabAfterActive(paneState, existing.id), existing.id);
    return {
      focusedPane: pane,
      [paneKey]: reorderPinnedTabs(nextPane, state.tabs)
    };
  }

  const newTab: FileTab = {
    content: file.content,
    id,
    kind: "file",
    name: file.name,
    path: file.path,
    savedContent: file.content
  };

  return {
    focusedPane: pane,
    tabs: { ...state.tabs, [id]: newTab },
    [paneKey]: activateTab(insertTabAfterActive(paneState, id), id)
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

  const nextPane = activateTab(insertTabAfterActive(paneState, id), id);

  return {
    focusedPane: pane,
    tabs: nextTabs,
    [paneKey]: reorderPinnedTabs(nextPane, nextTabs)
  };
}

export function openChartTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  chart: { id: string; name: string }
): Partial<EditorStoreModelState> {
  const id = `chart-${chart.id}`;
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];
  const existing = state.tabs[id];
  const nextTabs = existing
    ? { ...state.tabs, [id]: { ...existing, name: chart.name } }
    : { ...state.tabs, [id]: { chartId: chart.id, id, kind: "chart" as const, name: chart.name } satisfies ChartTab };

  const nextPane = activateTab(insertTabAfterActive(paneState, id), id);

  return {
    focusedPane: pane,
    tabs: nextTabs,
    [paneKey]: reorderPinnedTabs(nextPane, nextTabs)
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

export function markFileTabSavedState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return {
    tabs: {
      ...state.tabs,
      [tabId]: {
        ...tab,
        content,
        externalConflict: undefined,
        savedContent: content
      }
    }
  };
}

export function updateFileTabFromExternalState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  return markFileTabSavedState(state, tabId, content);
}

export function setFileTabExternalConflictState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return {
    tabs: {
      ...state.tabs,
      [tabId]: {
        ...tab,
        externalConflict: { content }
      }
    }
  };
}

export function resolveFileTabExternalConflictState(
  state: EditorStoreModelState,
  tabId: string,
  choice: "external" | "relic"
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file" || !tab.externalConflict) return state;

  const content = choice === "external" ? tab.externalConflict.content : tab.content;

  return markFileTabSavedState(state, tabId, content);
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

    const nextLeftPane = {
      activeTabId: newActiveId,
      history: [...state.leftPane.history, ...state.rightPane.history],
      tabIds: mergedTabIds
    };

    return {
      isSplit: false,
      focusedPane: "left",
      leftPane: reorderPinnedTabs(nextLeftPane, state.tabs),
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
  const paneState = state[paneKey];

  const nextTabIds = paneState.tabIds.filter((id) => id === tabId || state.tabs[id]?.isPinned);
  const removedIds = paneState.tabIds.filter(
    (id) => !nextTabIds.includes(id) && !otherPane.tabIds.includes(id)
  );
  const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs);

  return {
    tabs: nextTabs,
    [paneKey]: {
      activeTabId: tabId,
      history: [...paneState.history.filter((id) => nextTabIds.includes(id) && id !== tabId), tabId],
      tabIds: reorderPinnedTabs({ ...paneState, activeTabId: tabId, tabIds: nextTabIds }, nextTabs).tabIds
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
  const nextTabIds = idx === -1
    ? paneState.tabIds
    : paneState.tabIds.filter((id, index) => index <= idx || state.tabs[id]?.isPinned);
  const removedIds = paneState.tabIds.filter(
    (id) => !nextTabIds.includes(id) && !otherPane.tabIds.includes(id)
  );
  const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs);

  const activeWasRemoved = paneState.activeTabId !== null && !nextTabIds.includes(paneState.activeTabId);
  const nextActiveTabId = activeWasRemoved ? tabId : paneState.activeTabId;
  const nextHistory = paneState.history.filter((id) => nextTabIds.includes(id));

  return {
    tabs: nextTabs,
    [paneKey]: reorderPinnedTabs({
      activeTabId: nextActiveTabId,
      history: nextHistory,
      tabIds: nextTabIds
    }, nextTabs)
  };
}

export function closeAllTabsInPaneState(
  state: EditorStoreModelState,
  pane: PaneId
): Partial<EditorStoreModelState> {
  const paneKey = paneKeyFor(pane);
  const otherPane = state[otherPaneKeyFor(pane)];
  const paneState = state[paneKey];

  const nextTabIds = paneState.tabIds.filter((id) => state.tabs[id]?.isPinned);
  const removedIds = paneState.tabIds.filter((id) => !nextTabIds.includes(id) && !otherPane.tabIds.includes(id));
  const nextTabs = removedIds.reduce((acc, id) => omit(acc, id), state.tabs);
  const nextHistory = paneState.history.filter((id) => nextTabIds.includes(id));

  return {
    tabs: nextTabs,
    [paneKey]: {
      activeTabId: nextHistory.at(-1) ?? nextTabIds.at(-1) ?? null,
      history: nextHistory,
      tabIds: nextTabIds
    }
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
    const nextPane = {
      activeTabId: tabId,
      history: [...fromState.history.filter((id) => id !== tabId), tabId],
      tabIds: nextToIds
    };

    return {
      focusedPane: toPane,
      [toKey]: reorderPinnedTabs(nextPane, state.tabs)
    };
  }

  const nextFromPane = {
    activeTabId: nextFromActive,
    history: nextFromHistory,
    tabIds: nextFromIds
  };
  const nextToPane = {
    activeTabId: tabId,
    history: nextToHistory,
    tabIds: nextToIds
  };

  return {
    focusedPane: toPane,
    [fromKey]: reorderPinnedTabs(nextFromPane, state.tabs),
    [toKey]: reorderPinnedTabs(nextToPane, state.tabs)
  };
}

export function closeAllTabsState(): Pick<EditorStoreModelState, "leftPane" | "rightPane" | "tabs"> {
  return { tabs: {}, leftPane: emptyPane(), rightPane: emptyPane() };
}

export function toggleTabPinnedState(
  state: EditorStoreModelState,
  tabId: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (!tab) return state;

  const nextTab = { ...tab, isPinned: !tab.isPinned } satisfies Tab;
  const nextTabs = { ...state.tabs, [tabId]: nextTab };

  return {
    tabs: nextTabs,
    leftPane: reorderPinnedTabs(state.leftPane, nextTabs),
    rightPane: reorderPinnedTabs(state.rightPane, nextTabs)
  };
}

function activateTab(pane: PaneState, tabId: string): PaneState {
  return {
    ...pane,
    activeTabId: tabId,
    history: [...pane.history.filter((id) => id !== tabId), tabId]
  };
}

function insertTabAfterActive(pane: PaneState, tabId: string): PaneState {
  if (pane.tabIds.includes(tabId)) return pane;

  const activeIndex = pane.activeTabId ? pane.tabIds.indexOf(pane.activeTabId) : -1;
  if (activeIndex === -1) {
    return {
      ...pane,
      tabIds: [...pane.tabIds, tabId]
    };
  }

  return {
    ...pane,
    tabIds: [
      ...pane.tabIds.slice(0, activeIndex + 1),
      tabId,
      ...pane.tabIds.slice(activeIndex + 1)
    ]
  };
}

function reorderPinnedTabs(pane: PaneState, tabs: Record<string, Tab>): PaneState {
  return {
    ...pane,
    tabIds: [
      ...pane.tabIds.filter((id) => tabs[id]?.isPinned),
      ...pane.tabIds.filter((id) => !tabs[id]?.isPinned)
    ]
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
