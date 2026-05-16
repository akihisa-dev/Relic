import { useWorkspaceFileCreationActions } from "./useWorkspaceFileCreationActions";
import { useWorkspaceFileMutationActions } from "./useWorkspaceFileMutationActions";
import { useWorkspaceFileOpenActions } from "./useWorkspaceFileOpenActions";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";

export function useWorkspaceFileActions({
  aliasesByPath,
  closeAllTabs,
  closeTab,
  existingMarkdownPaths,
  focusedPane,
  leftPane,
  openFileInPane,
  rightPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  updateTabMeta,
  workspaceState
}: WorkspaceFileActionsContext) {
  const creationActions = useWorkspaceFileCreationActions({
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  });
  const openActions = useWorkspaceFileOpenActions({
    aliasesByPath,
    closeTab,
    existingMarkdownPaths,
    focusedPane,
    leftPane,
    openFileInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    tabs
  });
  const registryActions = useWorkspaceRegistryActions({
    closeAllTabs,
    setWorkspaceError,
    setWorkspaceState
  });
  const mutationActions = useWorkspaceFileMutationActions({
    closeTab,
    focusedPane,
    leftPane,
    openFileInPane,
    rightPane,
    setWorkspaceError,
    setWorkspaceState,
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
