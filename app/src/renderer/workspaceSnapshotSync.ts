import type { WorkspaceState } from "../shared/ipc";
import type { Translator } from "./i18nModel";
import { relicClient } from "./relicClient";
import { useEditorStore } from "./store/editorStore";
import { collectMarkdownPaths } from "./workspacePaths";

export interface ApplyWorkspaceSnapshotResult {
  applied: boolean;
  derivedDataUpdated: boolean;
  failedFileCount: number;
}

interface ApplyWorkspaceSnapshotInput {
  getActiveWorkspaceId: () => string | null;
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
  nextState,
  notifyFileFailures,
  onWorkspaceDataChanged,
  setWorkspaceError,
  setWorkspaceState,
  t,
  workspaceId
}: ApplyWorkspaceSnapshotInput): Promise<ApplyWorkspaceSnapshotResult> {
  const relic = relicClient.current;
  if (!relic || nextState.activeWorkspace?.id !== workspaceId) {
    return { applied: false, derivedDataUpdated: true, failedFileCount: 0 };
  }

  const nextFilePathSet = new Set(collectMarkdownPaths(nextState.fileTree));
  const protectedMissingTabIds = new Set<string>();
  const editorState = useEditorStore.getState();

  const closeMissingTabIfSafe = (pane: "left" | "right", tabId: string): void => {
    const tab = useEditorStore.getState().tabs[tabId];
    if (tab?.kind !== "file" || nextFilePathSet.has(tab.path)) return;

    if (tab.content === tab.savedContent && !tab.externalConflict) {
      useEditorStore.getState().closeTab(pane, tabId);
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

  if (getActiveWorkspaceId() !== workspaceId) {
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
    const externalContent = fileResult.value.content;

    if (externalContent === currentTab.savedContent) continue;
    if (externalContent === currentTab.content) {
      useEditorStore.getState().markTabSaved(tabId, externalContent);
      continue;
    }
    if (currentTab.content === currentTab.savedContent) {
      useEditorStore.getState().updateTabFromExternal(tabId, externalContent);
      continue;
    }

    const shouldNotify = currentTab.externalConflict?.content !== externalContent;
    useEditorStore.getState().setTabExternalConflict(tabId, externalContent);
    if (shouldNotify) setWorkspaceError(t("pane.externalConflictToast", { name: currentTab.name }));
  }

  if (getActiveWorkspaceId() !== workspaceId) {
    return { applied: false, derivedDataUpdated: true, failedFileCount };
  }

  setWorkspaceState(nextState);
  const derivedDataUpdated = await onWorkspaceDataChanged();
  return {
    applied: true,
    derivedDataUpdated,
    failedFileCount
  };
}
