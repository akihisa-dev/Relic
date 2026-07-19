import { flushPendingEditorChanges } from "../editorInputBuffer";
import type { EditorStoreActions, EditorStoreSet } from "./editorStoreContract";
import {
  closeAllTabsState,
  markFileTabSavedState,
  resolveFileTabExternalConflictState,
  setFileTabExternalConflictState,
  updateFileTabContentState,
  updateFileTabFromExternalState,
  updateFileTabMetaState
} from "./editorStoreModel";

type EditorContentActions = Pick<EditorStoreActions,
  | "closeAllTabs"
  | "markTabSaved"
  | "resolveTabExternalConflict"
  | "setEditorSettings"
  | "setTabExternalConflict"
  | "updateTabContent"
  | "updateTabFromExternal"
  | "updateTabMeta"
>;

export function createEditorContentActions(set: EditorStoreSet): EditorContentActions {
  return {
    updateTabContent: (tabId, content) => set((state) => updateFileTabContentState(state, tabId, content)),
    updateTabMeta: (tabId, meta) => {
      flushPendingEditorChanges([tabId]);
      set((state) => updateFileTabMetaState(state, tabId, meta));
    },
    markTabSaved: (tabId, content) => set((state) => markFileTabSavedState(state, tabId, content)),
    setTabExternalConflict: (tabId, content) => {
      flushPendingEditorChanges([tabId]);
      set((state) => setFileTabExternalConflictState(state, tabId, content));
    },
    resolveTabExternalConflict: (tabId, choice) => {
      flushPendingEditorChanges([tabId]);
      set((state) => resolveFileTabExternalConflictState(state, tabId, choice));
    },
    updateTabFromExternal: (tabId, content) => {
      flushPendingEditorChanges([tabId]);
      set((state) => updateFileTabFromExternalState(state, tabId, content));
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
  };
}
