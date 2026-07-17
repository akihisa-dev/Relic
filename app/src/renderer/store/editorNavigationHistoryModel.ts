import type { PaneId } from "./editorStoreTypes";
import type { EditorStoreModelState } from "./editorStoreModelTypes";
import { activateTab, paneKeyFor } from "./editorPaneStateModel";

export interface EditorNavigationEntry {
  pane: PaneId;
  tabId: string;
}

export interface EditorNavigationHistoryState {
  navigationHistory: EditorNavigationEntry[];
  navigationIndex: number;
}

type EditorNavigationStoreState = EditorStoreModelState & EditorNavigationHistoryState;
type EditorStoreModelPatch = Partial<EditorStoreModelState> | EditorStoreModelState;

export function recordEditorNavigationState(
  state: EditorNavigationStoreState,
  patch: EditorStoreModelPatch
): Partial<EditorNavigationStoreState> {
  const nextState = applyPatch(state, patch);
  const normalized = normalizeNavigationHistory(nextState, state.navigationHistory, state.navigationIndex);
  const currentEntry = currentNavigationEntry(nextState);

  if (!currentEntry) return { ...patch, ...normalized };

  const activeEntry = normalized.navigationHistory[normalized.navigationIndex];
  if (activeEntry?.tabId === currentEntry.tabId) {
    return {
      ...patch,
      navigationHistory: replaceEntry(
        normalized.navigationHistory,
        normalized.navigationIndex,
        currentEntry
      ),
      navigationIndex: normalized.navigationIndex
    };
  }

  const navigationHistory = normalized.navigationHistory.slice(0, normalized.navigationIndex + 1);
  const previousEntry = navigationHistory.at(-1);

  if (previousEntry?.tabId === currentEntry.tabId) {
    navigationHistory[navigationHistory.length - 1] = currentEntry;
  } else {
    navigationHistory.push(currentEntry);
  }

  return {
    ...patch,
    navigationHistory,
    navigationIndex: navigationHistory.length - 1
  };
}

export function pruneEditorNavigationState(
  state: EditorNavigationStoreState,
  patch: EditorStoreModelPatch
): Partial<EditorNavigationStoreState> {
  const nextState = applyPatch(state, patch);
  const normalized = normalizeNavigationHistory(nextState, state.navigationHistory, state.navigationIndex);
  const currentEntry = currentNavigationEntry(nextState);

  if (!currentEntry) return { ...patch, ...normalized };

  const activeEntry = normalized.navigationHistory[normalized.navigationIndex];
  if (activeEntry?.tabId === currentEntry.tabId) {
    return {
      ...patch,
      navigationHistory: replaceEntry(
        normalized.navigationHistory,
        normalized.navigationIndex,
        currentEntry
      ),
      navigationIndex: normalized.navigationIndex
    };
  }

  const currentIndex = findNearestEntryIndex(
    normalized.navigationHistory,
    normalized.navigationIndex,
    currentEntry.tabId
  );
  if (currentIndex !== -1) {
    return {
      ...patch,
      navigationHistory: replaceEntry(normalized.navigationHistory, currentIndex, currentEntry),
      navigationIndex: currentIndex
    };
  }

  const navigationHistory = normalized.navigationHistory.slice(0, normalized.navigationIndex + 1);
  navigationHistory.push(currentEntry);

  return {
    ...patch,
    navigationHistory,
    navigationIndex: navigationHistory.length - 1
  };
}

export function moveEditorNavigationState(
  state: EditorNavigationStoreState,
  direction: -1 | 1
): Partial<EditorNavigationStoreState> {
  const normalized = normalizeNavigationHistory(state, state.navigationHistory, state.navigationIndex);
  let targetIndex = normalized.navigationIndex + direction;

  while (targetIndex >= 0 && targetIndex < normalized.navigationHistory.length) {
    const entry = normalized.navigationHistory[targetIndex];
    const pane = resolveNavigationEntryPane(state, entry);

    if (pane) {
      const paneKey = paneKeyFor(pane);
      return {
        focusedPane: pane,
        [paneKey]: activateTab(state[paneKey], entry.tabId),
        navigationHistory: replaceEntry(normalized.navigationHistory, targetIndex, {
          pane,
          tabId: entry.tabId
        }),
        navigationIndex: targetIndex
      };
    }

    targetIndex += direction;
  }

  return normalized;
}

function applyPatch(
  state: EditorNavigationStoreState,
  patch: EditorStoreModelPatch
): EditorNavigationStoreState {
  return { ...state, ...patch };
}

function currentNavigationEntry(state: EditorStoreModelState): EditorNavigationEntry | null {
  const pane = state.focusedPane;
  if (pane === "right" && !state.isSplit) return null;

  const paneState = state[paneKeyFor(pane)];
  const tabId = paneState.activeTabId;
  if (!tabId || !state.tabs[tabId] || !paneState.tabIds.includes(tabId)) return null;

  return { pane, tabId };
}

function normalizeNavigationHistory(
  state: EditorStoreModelState,
  history: EditorNavigationEntry[],
  index: number
): EditorNavigationHistoryState {
  const navigationHistory: EditorNavigationEntry[] = [];
  let navigationIndex = -1;

  history.forEach((entry, entryIndex) => {
    const pane = resolveNavigationEntryPane(state, entry);
    if (!pane) return;

    const nextEntry = { pane, tabId: entry.tabId } satisfies EditorNavigationEntry;
    const previousEntry = navigationHistory.at(-1);
    if (previousEntry?.tabId === nextEntry.tabId) {
      navigationHistory[navigationHistory.length - 1] = nextEntry;
    } else {
      navigationHistory.push(nextEntry);
    }

    if (entryIndex <= index) navigationIndex = navigationHistory.length - 1;
  });

  return { navigationHistory, navigationIndex };
}

function resolveNavigationEntryPane(
  state: EditorStoreModelState,
  entry: EditorNavigationEntry
): PaneId | null {
  if (!state.tabs[entry.tabId]) return null;

  if (paneContainsTab(state, entry.pane, entry.tabId)) return entry.pane;

  const otherPane: PaneId = entry.pane === "left" ? "right" : "left";
  return paneContainsTab(state, otherPane, entry.tabId) ? otherPane : null;
}

function paneContainsTab(state: EditorStoreModelState, pane: PaneId, tabId: string): boolean {
  if (pane === "right" && !state.isSplit) return false;
  return state[paneKeyFor(pane)].tabIds.includes(tabId);
}

function replaceEntry(
  history: EditorNavigationEntry[],
  index: number,
  entry: EditorNavigationEntry
): EditorNavigationEntry[] {
  if (index < 0 || index >= history.length) return history;

  const nextHistory = [...history];
  nextHistory[index] = entry;
  return nextHistory;
}

function findNearestEntryIndex(
  history: EditorNavigationEntry[],
  index: number,
  tabId: string
): number {
  for (let entryIndex = Math.min(index, history.length - 1); entryIndex >= 0; entryIndex -= 1) {
    if (history[entryIndex].tabId === tabId) return entryIndex;
  }

  for (let entryIndex = Math.max(index + 1, 0); entryIndex < history.length; entryIndex += 1) {
    if (history[entryIndex].tabId === tabId) return entryIndex;
  }

  return -1;
}
