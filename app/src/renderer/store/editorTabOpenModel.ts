import type { MarkdownFileContent } from "../../shared/ipc";
import type {
  ChartTab,
  FileTab,
  ImageTab,
  PaneId,
  PanelTab,
  PanelTabKind,
  PdfTab
} from "./editorStoreTypes";
import type { EditorStoreModelState } from "./editorStoreModelTypes";
import {
  activateTab,
  insertTabAfterActive,
  paneKeyFor,
  reorderPinnedTabs
} from "./editorPaneStateModel";

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

export function openImageTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  image: { name: string; path: string },
  id: string
): Partial<EditorStoreModelState> {
  const existing = Object.values(state.tabs).find((tab) => tab.kind === "image" && tab.path === image.path);
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];

  if (existing) {
    const nextPane = activateTab(insertTabAfterActive(paneState, existing.id), existing.id);
    return {
      focusedPane: pane,
      [paneKey]: reorderPinnedTabs(nextPane, state.tabs)
    };
  }

  const newTab: ImageTab = {
    id,
    kind: "image",
    name: image.name,
    path: image.path
  };

  return {
    focusedPane: pane,
    tabs: { ...state.tabs, [id]: newTab },
    [paneKey]: activateTab(insertTabAfterActive(paneState, id), id)
  };
}

export function openPdfTabState(
  state: EditorStoreModelState,
  pane: PaneId,
  pdf: { name: string; path: string },
  id: string
): Partial<EditorStoreModelState> {
  const existing = Object.values(state.tabs).find((tab) => tab.kind === "pdf" && tab.path === pdf.path);
  const paneKey = paneKeyFor(pane);
  const paneState = state[paneKey];

  if (existing) {
    const nextPane = activateTab(insertTabAfterActive(paneState, existing.id), existing.id);
    return {
      focusedPane: pane,
      [paneKey]: reorderPinnedTabs(nextPane, state.tabs)
    };
  }

  const newTab: PdfTab = {
    id,
    kind: "pdf",
    name: pdf.name,
    path: pdf.path
  };

  return {
    focusedPane: pane,
    tabs: { ...state.tabs, [id]: newTab },
    [paneKey]: activateTab(insertTabAfterActive(paneState, id), id)
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
