import { flushPendingEditorChanges } from "../editorInputBuffer";
import { rememberClosedTabs, reopenClosedTabState } from "./editorClosedTabHistoryModel";
import type { EditorStore, EditorStoreActions, EditorStoreSet } from "./editorStoreContract";
import {
  moveEditorNavigationState,
  pruneEditorNavigationState,
  recordEditorNavigationState
} from "./editorNavigationHistoryModel";
import {
  closeAllTabsInPaneState,
  closeOtherTabsState,
  closeTabState,
  closeTabsToRightState,
  moveTabState,
  setTabActiveState,
  toggleSplitState,
  toggleTabPinnedState
} from "./editorStoreModel";

type EditorNavigationActions = Pick<EditorStoreActions,
  | "closeAllTabsInPane"
  | "closeOtherTabs"
  | "closeTab"
  | "closeTabsToRight"
  | "moveTab"
  | "navigateBack"
  | "navigateForward"
  | "reopenClosedTab"
  | "setFocusedPane"
  | "setTabActive"
  | "toggleSplit"
  | "toggleTabPinned"
>;

export function createEditorNavigationActions(set: EditorStoreSet): EditorNavigationActions {
  return {
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
      set((state) => recordEditorNavigationState(state, setTabActiveState(state, pane, tabId)));
    },
    navigateBack: () => {
      flushPendingEditorChanges();
      set((state) => moveEditorNavigationState(state, -1));
    },
    navigateForward: () => {
      flushPendingEditorChanges();
      set((state) => moveEditorNavigationState(state, 1));
    },
    toggleTabPinned: (tabId) => set((state) => toggleTabPinnedState(state, tabId)),
    toggleSplit: () => set((state) => recordEditorNavigationState(state, toggleSplitState(state))),
    setFocusedPane: (pane) => set((state) => recordEditorNavigationState(state, { focusedPane: pane })),
    closeOtherTabs: (pane, tabId) => closeTabs(set, pane, (state) => closeOtherTabsState(state, pane, tabId)),
    closeTabsToRight: (pane, tabId) => closeTabs(set, pane, (state) => closeTabsToRightState(state, pane, tabId)),
    closeAllTabsInPane: (pane) => closeTabs(set, pane, (state) => closeAllTabsInPaneState(state, pane)),
    moveTab: (fromPane, toPane, tabId, targetTabId = null, position = "after") => {
      flushPendingEditorChanges([tabId]);
      set((state) => recordEditorNavigationState(
        state,
        moveTabState(state, fromPane, toPane, tabId, targetTabId, position)
      ));
    }
  };
}

function closeTabs(
  set: EditorStoreSet,
  pane: "left" | "right",
  createPatch: (state: EditorStore) => Partial<EditorStore>
): void {
  flushPendingEditorChanges();
  set((state) => {
    const closePatch = createPatch(state);
    const closedTabs = rememberClosedTabs(state, pane, closePatch, true);
    return { ...pruneEditorNavigationState(state, closePatch), closedTabs };
  });
}
