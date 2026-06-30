import { useWorkspaceFileCreationActions } from "./useWorkspaceFileCreationActions";
import { useWorkspaceFileMutationActions } from "./useWorkspaceFileMutationActions";
import { useWorkspaceFileOpenActions } from "./useWorkspaceFileOpenActions";
import { useWorkspaceRegistryActions } from "./useWorkspaceRegistryActions";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { Translator } from "../i18nModel";

type UseWorkspaceFileActionsInput = WorkspaceFileActionsContext & {
  beforeCloseAllTabs?: () => Promise<boolean> | boolean;
  beforeMutateWorkspaceItems?: WorkspaceFileActionsContext["beforeMutateWorkspaceItems"];
  t: Translator;
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
    openImageInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    tabs
  });
  const registryActions = useWorkspaceRegistryActions({
    beforeCloseAllTabs,
    closeAllTabs,
    setWorkspaceError,
    setWorkspaceState
  });
  const mutationActions = useWorkspaceFileMutationActions({
    beforeMutateWorkspaceItems,
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
