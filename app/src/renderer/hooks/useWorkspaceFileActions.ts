import { useWorkspaceFileCreationActions } from "./useWorkspaceFileCreationActions";
import { useWorkspaceFileMutationActions } from "./useWorkspaceFileMutationActions";
import { useWorkspaceFileOpenActions } from "./useWorkspaceFileOpenActions";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { Translator } from "../i18nModel";

type UseWorkspaceFileActionsInput = WorkspaceFileActionsContext & {
  beforeCloseAllTabs?: () => Promise<boolean> | boolean;
  beforeMutateWorkspaceItems?: WorkspaceFileActionsContext["beforeMutateWorkspaceItems"];
  t: Translator;
  workspaceRequestGuard: WorkspaceRequestGuard;
};

export function useWorkspaceFileActions({
  aliasesByPath,
  beforeCloseAllTabs,
  beforeMutateWorkspaceItems,
  closeAllTabs,
  closeTab,
  existingMarkdownPaths,
  focusedPane,
  leftPane,
  openFileInPane,
  openImageInPane,
  openPdfInPane,
  rightPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  t,
  updateTabMeta,
  workspaceRequestGuard,
  workspaceState
}: UseWorkspaceFileActionsInput) {
  const activeWorkspaceId = workspaceState?.activeWorkspace?.id ?? null;
  const activeWorkspacePath = workspaceState?.activeWorkspace?.path ?? null;
  const creationActions = useWorkspaceFileCreationActions({
    ...workspaceRequestGuard,
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  });
  const openActions = useWorkspaceFileOpenActions({
    ...workspaceRequestGuard,
    activeWorkspaceId,
    aliasesByPath,
    existingMarkdownPaths,
    focusedPane,
    leftPane,
    openFileInPane,
    openImageInPane,
    openPdfInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    tabs
  });
  const registryActions = useWorkspaceRegistryActions({
    ...workspaceRequestGuard,
    activeWorkspaceId,
    activeWorkspacePath,
    beforeCloseAllTabs,
    closeAllTabs,
    setWorkspaceError,
    setWorkspaceState
  });
  const mutationActions = useWorkspaceFileMutationActions({
    ...workspaceRequestGuard,
    beforeMutateWorkspaceItems: workspaceState?.availability?.fileOperationsAvailable === false
      ? () => {
        setWorkspaceError(t("files.workspaceUnavailableOperations"));
        return false;
      }
      : beforeMutateWorkspaceItems,
    closeTab,
    focusedPane,
    leftPane,
    openFileInPane,
    openImageInPane,
    rightPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs,
    updateTabMeta
  });

  return {
    ...creationActions,
    ...mutationActions,
    ...openActions,
    ...registryActions
  };
}
