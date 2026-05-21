import { useCardbookCardCreationActions } from "./useCardbookCardCreationActions";
import { useCardbookCardMutationActions } from "./useCardbookCardMutationActions";
import { useCardbookCardOpenActions } from "./useCardbookCardOpenActions";
import { useCardbookRegistryActions } from "./useCardbookRegistryActions";
import type { CardbookCardActionsContext } from "./cardbookCardActionTypes";
import type { Translator } from "../i18n";

type UseCardbookCardActionsInput = CardbookCardActionsContext & {
  t: Translator;
};

export function useCardbookCardActions({
  aliasesByPath,
  closeAllTabs,
  closeTab,
  existingMarkdownPaths,
  focusedPane,
  leftPane,
  openCardInPane,
  rightPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setCardbookError,
  setCardbookState,
  tabs,
  t,
  updateTabMeta,
  cardbookState
}: UseCardbookCardActionsInput) {
  const creationActions = useCardbookCardCreationActions({
    focusedPane,
    openCardInPane,
    setCardbookError,
    setCardbookState,
    t,
    cardbookState
  });
  const openActions = useCardbookCardOpenActions({
    aliasesByPath,
    closeTab,
    existingMarkdownPaths,
    focusedPane,
    leftPane,
    openCardInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setCardbookError,
    setCardbookState,
    tabs
  });
  const registryActions = useCardbookRegistryActions({
    closeAllTabs,
    setCardbookError,
    setCardbookState
  });
  const mutationActions = useCardbookCardMutationActions({
    closeTab,
    focusedPane,
    leftPane,
    openCardInPane,
    rightPane,
    setCardbookError,
    setCardbookState,
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
