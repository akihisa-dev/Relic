import type { Tab } from "./editorStoreTypes";
import type { EditorStoreModelState } from "./editorStoreModelTypes";

type WorkspacePathTab = Extract<Tab, { kind: "file" | "image" | "pdf" }>;

export function updateFileTabContentState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return { tabs: { ...state.tabs, [tabId]: { ...tab, content } } };
}

export function markFileTabSavedState(
  state: EditorStoreModelState,
  tabId: string,
  content: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return {
    tabs: {
      ...state.tabs,
      [tabId]: {
        ...tab,
        content,
        externalConflict: undefined,
        savedContent: content
      }
    }
  };
}

export function markFileTabSavedCheckpointState(
  state: EditorStoreModelState,
  tabId: string,
  savedContent: string
): Partial<EditorStoreModelState> | EditorStoreModelState {
  const tab = state.tabs[tabId];
  if (tab?.kind !== "file") return state;

  return {
    tabs: {
      ...state.tabs,
      [tabId]: {
        ...tab,
        savedContent
      }
    }
  };
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

  return {
    tabs: {
      ...state.tabs,
      [tabId]: {
        ...tab,
        externalConflict: { content }
      }
    }
  };
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
