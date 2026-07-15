import type { EditorSettings } from "../../shared/ipc";
import type { PaneId, PaneState, Tab } from "./editorStoreTypes";

export interface EditorStoreModelState {
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  isSplit: boolean;
  leftPane: PaneState;
  rightPane: PaneState;
  tabs: Record<string, Tab>;
}
