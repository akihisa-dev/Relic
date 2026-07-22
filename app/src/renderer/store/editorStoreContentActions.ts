import { flushPendingEditorChanges } from "../editorInputBuffer";
import type { EditorStoreActions, EditorStoreSet } from "./editorStoreContract";
import { emitEditorTabChanged } from "./editorTabChangeEvents";
import {
  closeAllTabsState,
  markFileTabSavedCheckpointState,
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
  | "markTabSavedCheckpoint"
  | "resolveTabExternalConflict"
  | "setEditorSettings"
  | "setTabExternalConflict"
  | "updateTabContent"
  | "updateTabFromExternal"
  | "updateTabMeta"
>;

export function createEditorContentActions(set: EditorStoreSet): EditorContentActions {
  return {
    updateTabContent: (tabId, content, update) => {
      set((state) => updateFileTabContentState(state, tabId, content, update));
      emitEditorTabChanged(tabId);
    },
    updateTabMeta: (tabId, meta) => {
      flushPendingEditorChanges([tabId]);
      set((state) => updateFileTabMetaState(state, tabId, meta));
      emitEditorTabChanged(tabId);
    },
    markTabSaved: (tabId, content) => {
      set((state) => markFileTabSavedState(state, tabId, content));
      emitEditorTabChanged(tabId);
    },
    markTabSavedCheckpoint: (tabId, content) => {
      set((state) => markFileTabSavedCheckpointState(state, tabId, content));
      emitEditorTabChanged(tabId);
    },
    setTabExternalConflict: (tabId, content) => {
      flushPendingEditorChanges([tabId]);
      set((state) => setFileTabExternalConflictState(state, tabId, content));
      emitEditorTabChanged(tabId);
    },
    resolveTabExternalConflict: (tabId, choice) => {
      flushPendingEditorChanges([tabId]);
      set((state) => resolveFileTabExternalConflictState(state, tabId, choice));
      emitEditorTabChanged(tabId);
    },
    updateTabFromExternal: (tabId, content) => {
      flushPendingEditorChanges([tabId]);
      set((state) => updateFileTabFromExternalState(state, tabId, content));
      emitEditorTabChanged(tabId);
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
