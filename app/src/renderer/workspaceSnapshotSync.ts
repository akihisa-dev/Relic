import { hasMarkdownExtension } from "../shared/markdownExtension";
import { isSafeWorkspaceChangedPath, type WorkspaceState } from "../shared/ipc";
import type { Translator } from "./i18nModel";
import { relicClient } from "./relicClient";
import { useEditorStore } from "./store/editorStore";
import { collectMarkdownPaths } from "./workspacePaths";
import { flushPendingEditorChanges } from "./editorInputBuffer";
import type { IsCurrentRequest } from "./hooks/useAsyncRequestGuard";

export interface ApplyWorkspaceSnapshotResult {
  applied: boolean;
  derivedDataUpdated: boolean;
  failedFileCount: number;
}

export interface ApplyWorkspacePathsResult {
  failedFileCount: number;
  applied: boolean;
}

interface ApplyWorkspaceSnapshotInput {
  getActiveWorkspaceId: () => string | null;
  isCurrentWorkspace: IsCurrentRequest;
  nextState: WorkspaceState;
  notifyFileFailures: boolean;
  onWorkspaceDataChanged: () => Promise<boolean>;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  t: Translator;
  workspaceId: string;
}

export async function applyWorkspaceSnapshot({
  getActiveWorkspaceId,
  isCurrentWorkspace,
  nextState,
  notifyFileFailures,
  onWorkspaceDataChanged,
  setWorkspaceError,
  setWorkspaceState,
  t,
  workspaceId
}: ApplyWorkspaceSnapshotInput): Promise<ApplyWorkspaceSnapshotResult> {
  const relic = relicClient.current;
  if (!isCurrentWorkspace() || !relic || nextState.activeWorkspace?.id !== workspaceId) {
    return { applied: false, derivedDataUpdated: true, failedFileCount: 0 };
  }

  flushPendingEditorChanges();

  const nextFilePathSet = new Set(collectMarkdownPaths(nextState.fileTree));
  const protectedMissingTabIds = new Set<string>();
  const editorState = useEditorStore.getState();

  const closeMissingTabIfSafe = (pane: "left" | "right", tabId: string): void => {
    const tab = useEditorStore.getState().tabs[tabId];
    if (tab?.kind !== "file" || nextFilePathSet.has(tab.path)) return;

    if (tab.content === tab.savedContent && !tab.externalConflict) {
      useEditorStore.getState().closeTab(pane, tabId, false);
      return;
    }

    if (protectedMissingTabIds.has(tabId)) return;
    protectedMissingTabIds.add(tabId);
    setWorkspaceError(t("pane.missingDirtyTabToast", { name: tab.name }));
  };

  for (const tabId of editorState.leftPane.tabIds) closeMissingTabIfSafe("left", tabId);
  for (const tabId of editorState.rightPane.tabIds) closeMissingTabIfSafe("right", tabId);

  const openFileEntries = Object.entries(useEditorStore.getState().tabs).flatMap(([tabId, tab]) =>
    tab.kind === "file" && nextFilePathSet.has(tab.path)
      ? [{ path: tab.path, tabId }]
      : []
  );
  const fileResults = await Promise.all(openFileEntries.map(async ({ path, tabId }) => ({
    fileResult: await relic.readMarkdownFile({ path }),
    tabId
  })));

  if (!isCurrentWorkspace() || getActiveWorkspaceId() !== workspaceId) {
    return { applied: false, derivedDataUpdated: true, failedFileCount: 0 };
  }

  let failedFileCount = 0;
  for (const { fileResult, tabId } of fileResults) {
    if (!fileResult.ok) {
      failedFileCount += 1;
      if (notifyFileFailures) setWorkspaceError(fileResult.error.message);
      continue;
    }

    const currentTab = useEditorStore.getState().tabs[tabId];
    if (currentTab?.kind !== "file") continue;
    applyExternalContent(
      currentTab.id,
      currentTab.name,
      currentTab.content,
      currentTab.savedContent,
      currentTab.externalConflict?.content,
      fileResult.value.content,
      setWorkspaceError,
      (name) => t("pane.externalConflictToast", { name })
    );
  }

  if (!isCurrentWorkspace() || getActiveWorkspaceId() !== workspaceId) {
    return { applied: false, derivedDataUpdated: true, failedFileCount };
  }

  setWorkspaceState(nextState);
  if (!isCurrentWorkspace()) {
    return { applied: false, derivedDataUpdated: true, failedFileCount };
  }
  const derivedDataUpdated = await onWorkspaceDataChanged();
  if (!isCurrentWorkspace()) {
    return { applied: false, derivedDataUpdated, failedFileCount };
  }
  return {
    applied: true,
    derivedDataUpdated,
    failedFileCount
  };
}

export async function applyWorkspacePaths({
  getActiveWorkspaceId,
  isCurrentWorkspace,
  paths,
  conflictMessage,
  setWorkspaceError,
  workspaceId
}: {
  getActiveWorkspaceId: () => string | null;
  isCurrentWorkspace: IsCurrentRequest;
  conflictMessage: (name: string) => string;
  paths: string[];
  setWorkspaceError: (message: string | null) => void;
  workspaceId: string;
}): Promise<ApplyWorkspacePathsResult> {
  const relic = relicClient.current;
  const safePaths = [...new Set(paths.filter((path) => isSafeWorkspaceChangedPath(path) && hasMarkdownExtension(path)))];
  const safePathSet = new Set(safePaths);
  if (!isCurrentWorkspace() || getActiveWorkspaceId() !== workspaceId || !relic) {
    return { applied: false, failedFileCount: 0 };
  }

  const openFileEntries = Object.entries(useEditorStore.getState().tabs).flatMap(([tabId, tab]) => (
    tab.kind === "file" && safePathSet.has(tab.path)
      ? [{ path: tab.path, tabId }]
      : []
  ));
  flushPendingEditorChanges(openFileEntries.map(({ tabId }) => tabId));
  const fileResults = await Promise.all(openFileEntries.map(async ({ path, tabId }) => ({
    fileResult: await relic.readMarkdownFile({ path }),
    tabId
  })));

  if (!isCurrentWorkspace() || getActiveWorkspaceId() !== workspaceId) {
    return { applied: false, failedFileCount: 0 };
  }

  let failedFileCount = 0;
  for (const { fileResult, tabId } of fileResults) {
    if (!fileResult.ok) {
      failedFileCount += 1;
      setWorkspaceError(fileResult.error.message);
      continue;
    }

    const currentTab = useEditorStore.getState().tabs[tabId];
    if (currentTab?.kind !== "file") continue;
    applyExternalContent(
      currentTab.id,
      currentTab.name,
      currentTab.content,
      currentTab.savedContent,
      currentTab.externalConflict?.content,
      fileResult.value.content,
      setWorkspaceError,
      conflictMessage
    );
  }

  return { applied: true, failedFileCount };
}

function applyExternalContent(
  tabId: string,
  tabName: string,
  currentContent: string,
  savedContent: string,
  previousConflictContent: string | undefined,
  externalContent: string,
  setWorkspaceError: (message: string | null) => void,
  conflictMessage: (name: string) => string
): void {
  if (externalContent === savedContent) return;
  if (externalContent === currentContent) {
    useEditorStore.getState().markTabSaved(tabId, externalContent);
    return;
  }
  if (currentContent === savedContent) {
    useEditorStore.getState().updateTabFromExternal(tabId, externalContent);
    return;
  }
  useEditorStore.getState().setTabExternalConflict(tabId, externalContent);
  if (previousConflictContent !== externalContent) {
    // Keep this callback generic: callers that need a localized conflict toast
    // can surface it separately while the tab retains the full conflict data.
    setWorkspaceError(conflictMessage(tabName));
  }
}
