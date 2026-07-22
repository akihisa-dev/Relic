import type { Tab } from "./editorStoreTypes";
import type { EditorContentUpdateInput } from "../editorContentUpdate";
import { transferEditorTabContentIndex } from "../editorTabIndexes";
import type { EditorStoreModelState } from "./editorStoreModelTypes";

type WorkspacePathTab = Extract<Tab, { kind: "file" | "image" | "pdf" }>;

export function updateFileTabContentState(
  state: EditorStoreModelState,
  tabId: string,
  content: string,
  update?: EditorContentUpdateInput
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  if (tab.content === content) return state;
  const previousRevision = tab.contentRevision ?? 0;
  const revision = previousRevision + 1;
  const nextTab = {
    ...tab,
    content,
    contentRevision: revision,
    contentUpdate: update ? { ...update, previousRevision, revision } : undefined
  };
  const tabs = { ...state.tabs, [tabId]: nextTab };
  transferEditorTabContentIndex(state.tabs, tabs, tab, nextTab);
  return { tabs };
}

export function markFileTabSavedState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  const contentChanged = tab.content !== content;
  const previousRevision = tab.contentRevision ?? 0;

  const nextTab = {
    ...tab,
    content,
    ...(contentChanged ? {
      contentRevision: previousRevision + 1,
      contentUpdate: undefined
    } : {}),
    externalConflict: undefined,
    savedContent: content
  };
  const tabs = { ...state.tabs, [tabId]: nextTab };
  transferEditorTabContentIndex(state.tabs, tabs, tab, nextTab);
  return { tabs };
}

export function markFileTabSavedCheckpointState(
  state: EditorStoreModelState,
  tabId: string,
  savedContent: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  const nextTab = { ...tab, savedContent };
  const tabs = { ...state.tabs, [tabId]: nextTab };
  transferEditorTabContentIndex(state.tabs, tabs, tab, nextTab);
  return { tabs };
}

export function updateFileTabFromExternalState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  return markFileTabSavedState(state, tabId, content);
}

export function setFileTabExternalConflictState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  const nextTab = { ...tab, externalConflict: { content } };
  const tabs = { ...state.tabs, [tabId]: nextTab };
  transferEditorTabContentIndex(state.tabs, tabs, tab, nextTab);
  return { tabs };
}

export function resolveFileTabExternalConflictState(
  state: EditorStoreModelState,
  tabId: string,
  choice: "external" | "relic"
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file" || !tab.externalConflict) return state;

  const content = choice === "external" ? tab.externalConflict.content : tab.content;

  return markFileTabSavedState(state, tabId, content);
}

export function updateFileTabMetaState(
  state: EditorStoreModelState,
  tabId: string,
  meta: Pick<WorkspacePathTab, "name" | "path">
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file" && tab?.kind !== "image" && tab?.kind !== "pdf") return state;

  return { tabs: { ...state.tabs, [tabId]: { ...tab, ...meta } } };
}
