import { create } from "zustand";

import type { EditorStore } from "./editorStoreContract";
import { createEditorStore } from "./editorStoreRuntime";

export type {
  ChartTab,
  FileTab,
  ImageTab,
  PaneId,
  PaneState,
  PdfTab,
  PanelTab,
  PanelTabKind,
  Tab
} from "./editorStoreTypes";

export const useEditorStore = create<EditorStore>(createEditorStore);
