import {
  openChartTabState,
  openFileTabState,
  openImageTabState,
  openPanelTabState,
  openPdfTabState
} from "./editorStoreModel";
import type { EditorStoreActions, EditorStoreSet } from "./editorStoreContract";
import { recordEditorNavigationState } from "./editorNavigationHistoryModel";

type EditorOpenActions = Pick<EditorStoreActions,
  | "openChartInPane"
  | "openFileInPane"
  | "openImageInPane"
  | "openPanelInPane"
  | "openPdfInPane"
>;

export function createEditorOpenActions(set: EditorStoreSet): EditorOpenActions {
  return {
    openFileInPane: (pane, file) => {
      const id = createTabId("tab");
      set((state) => recordEditorNavigationState(state, openFileTabState(state, pane, file, id)));
    },
    openImageInPane: (pane, image) => {
      const id = createTabId("image");
      set((state) => recordEditorNavigationState(state, openImageTabState(state, pane, image, id)));
    },
    openPdfInPane: (pane, pdf) => {
      const id = createTabId("pdf");
      set((state) => recordEditorNavigationState(state, openPdfTabState(state, pane, pdf, id)));
    },
    openPanelInPane: (pane, panel, name) => {
      set((state) => recordEditorNavigationState(state, openPanelTabState(state, pane, panel, name)));
    },
    openChartInPane: (pane, chart) => {
      set((state) => recordEditorNavigationState(state, openChartTabState(state, pane, chart)));
    }
  };
}

function createTabId(prefix: "image" | "pdf" | "tab"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
