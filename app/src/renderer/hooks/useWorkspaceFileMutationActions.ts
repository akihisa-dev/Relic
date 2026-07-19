import { useCallback } from "react";

import type { Translator } from "../i18nModel";
import { buildFolderTabPathUpdates } from "./workspaceFileActionHelpers";
import type { WorkspaceFileMutationInput } from "./workspaceFileMutationShared";
import { fileTabIdForPath } from "./workspaceFileMutationShared";
import { useWorkspaceDuplicateDeleteActions } from "./useWorkspaceDuplicateDeleteActions";
import { useWorkspaceFileImportActions } from "./useWorkspaceFileImportActions";
import { useWorkspaceMoveRenameActions } from "./useWorkspaceMoveRenameActions";
import { useWorkspaceMutationRunner } from "./useWorkspaceMutationRunner";

export function useWorkspaceFileMutationActions(input: WorkspaceFileMutationInput & { t: Translator }) {
  const runner = useWorkspaceMutationRunner({
    beforeMutateWorkspaceItems: input.beforeMutateWorkspaceItems,
    setWorkspaceError: input.setWorkspaceError,
    t: input.t
  });
  const updateMovedFileTab = useCallback(
    (oldPath: string, file: { name: string; path: string }, preferredTabId?: string): void => {
      const tabId = preferredTabId ?? fileTabIdForPath(input.tabs, oldPath);
      if (tabId) input.updateTabMeta(tabId, { name: file.name, path: file.path });
    },
    [input.tabs, input.updateTabMeta]
  );
  const updateMovedFolderTabs = useCallback((oldPath: string, newPath: string): void => {
    buildFolderTabPathUpdates(input.tabs, oldPath, newPath)
      .forEach((update) => input.updateTabMeta(update.tabId, { name: update.name, path: update.path }));
  }, [input.tabs, input.updateTabMeta]);

  return {
    ...useWorkspaceDuplicateDeleteActions({ ...input, runner }),
    ...useWorkspaceFileImportActions(input),
    ...useWorkspaceMoveRenameActions({ ...input, runner, updateMovedFileTab, updateMovedFolderTabs })
  };
}
