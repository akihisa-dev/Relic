import { useWorkspaceFileCreationActions } from "./useWorkspaceFileCreationActions";
import { useWorkspaceFileMutationActions } from "./useWorkspaceFileMutationActions";
import { useWorkspaceFileOpenActions } from "./useWorkspaceFileOpenActions";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { Translator } from "../i18n";

type UseWorkspaceFileActionsInput = WorkspaceFileActionsContext & {
  t: Translator;
};

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
  t,
  updateTabMeta,
  workspaceState
}: UseWorkspaceFileActionsInput) {
  const creationActions = useWorkspaceFileCreationActions({
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    t,
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
