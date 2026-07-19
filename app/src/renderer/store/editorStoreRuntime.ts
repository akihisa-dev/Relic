import { defaultEditorSettings } from "../../shared/ipc";
import { emptyPane } from "./editorStoreModel";
import { createEditorContentActions } from "./editorStoreContentActions";
import type { EditorStore } from "./editorStoreContract";
import { createEditorNavigationActions } from "./editorStoreNavigationActions";
import { createEditorOpenActions } from "./editorStoreOpenActions";

export function createEditorStore(set: Parameters<typeof createEditorOpenActions>[0]): EditorStore {
  return {
    closedTabs: [],
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: emptyPane(),
    navigationHistory: [],
    navigationIndex: -1,
    rightPane: emptyPane(),
    tabs: {},
    ...createEditorOpenActions(set),
    ...createEditorNavigationActions(set),
    ...createEditorContentActions(set)
  };
}
