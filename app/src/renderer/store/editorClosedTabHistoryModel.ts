import type { EditorStoreModelState } from "./editorStoreModelTypes";
import { activateTab, paneKeyFor, reorderPinnedTabs } from "./editorPaneStateModel";
import type { PaneId, Tab } from "./editorStoreTypes";

const CLOSED_TAB_HISTORY_LIMIT = 20;

export interface ClosedTabEntry {
  index: number;
  pane: PaneId;
  tab: Tab;
}

export interface ClosedTabHistoryState {
  closedTabs: ClosedTabEntry[];
}

type EditorClosedTabState = EditorStoreModelState & ClosedTabHistoryState;

export function rememberClosedTabs(
  state: EditorClosedTabState,
  pane: PaneId,
  nextState: Partial<EditorStoreModelState>,
  remember: boolean
): ClosedTabEntry[] {
  const paneKey = paneKeyFor(pane);
  const nextPane = nextState[paneKey] ?? state[paneKey];
  const entries = state[paneKey].tabIds.flatMap((tabId, index) => {
    const tab = state.tabs[tabId];
    return tab && !nextPane.tabIds.includes(tabId) ? [{ index, pane, tab }] : [];
  });

  if (!remember) {
    return state.closedTabs.filter(
      (entry) => !entries.some((removed) => areEquivalentTabs(entry.tab, removed.tab))
    );
  }

  return [...state.closedTabs, ...entries].slice(-CLOSED_TAB_HISTORY_LIMIT);
}

export function reopenClosedTabState(
  state: EditorClosedTabState
): (Partial<EditorStoreModelState> & ClosedTabHistoryState) | null {
  const entry = state.closedTabs.at(-1);
  if (!entry) return null;

  const pane: PaneId = entry.pane === "right" && !state.isSplit ? "left" : entry.pane;
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];
  const existingTabId = findEquivalentTabId(state.tabs, entry.tab) ?? entry.tab.id;
  const tabs = state.tabs[existingTabId]
    ? state.tabs
    : { ...state.tabs, [existingTabId]: { ...entry.tab, id: existingTabId } };

  const nextTabIds = paneState.tabIds.includes(existingTabId)
    ? paneState.tabIds
    : insertAt(paneState.tabIds, existingTabId, entry.index);
  const nextPane = reorderPinnedTabs(
    activateTab({ ...paneState, tabIds: nextTabIds }, existingTabId),
    tabs
  );

  return {
    closedTabs: state.closedTabs.slice(0, -1),
    focusedPane: pane,
    tabs,
    [paneKey]: nextPane
  };
}

function findEquivalentTabId(tabs: Record<string, Tab>, target: Tab): string | null {
  const match = Object.values(tabs).find((tab) => areEquivalentTabs(tab, target));

  return match?.id ?? null;
}

function areEquivalentTabs(tab: Tab, target: Tab): boolean {
  if (tab.kind !== target.kind) return false;

  switch (target.kind) {
    case "file":
    case "image":
    case "pdf":
      return "path" in tab && tab.path === target.path;
    case "panel":
      return tab.kind === "panel" && tab.panel === target.panel;
    case "chart":
      return tab.kind === "chart" && tab.chartId === target.chartId;
  }
}

function insertAt(tabIds: string[], tabId: string, index: number): string[] {
  const insertIndex = Math.max(0, Math.min(index, tabIds.length));
  return [...tabIds.slice(0, insertIndex), tabId, ...tabIds.slice(insertIndex)];
}
