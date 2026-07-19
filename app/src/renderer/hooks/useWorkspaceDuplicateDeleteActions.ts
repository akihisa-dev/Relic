import { useCallback } from "react";

import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import { removeCoveredItems } from "./workspaceFileActionHelpers";
import type { WorkspaceFileMutationInput, WorkspaceMutationRunner } from "./workspaceFileMutationShared";
import {
  deleteTreeItemMessage,
  deleteTreeItemsMessage,
  getActiveFileTab,
  tabCloseTargetsForTreeItem,
  tabCloseTargetsForTreeItems
} from "./workspaceFileMutationModel";

export function useWorkspaceDuplicateDeleteActions({
  closeTab,
  focusedPane,
  leftPane,
  openFileInPane,
  rightPane,
  runner,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  t
}: WorkspaceFileMutationInput & { runner: WorkspaceMutationRunner; t: Translator }) {
  const handleDuplicateActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path: activeFile.tab.path, type: "file" }],
      () => relicClient.current!.duplicateMarkdownFile({ path: activeFile.tab.path }),
      (value) => {
        setWorkspaceState(value.workspaceState);
        openFileInPane(focusedPane, value.file);
      }
    );
  }, [focusedPane, leftPane, openFileInPane, rightPane, runner, setWorkspaceState, tabs]);

  const handleDuplicateTreeFile = useCallback((path: string): void => {
    if (!relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path, type: "file" }],
      () => relicClient.current!.duplicateMarkdownFile({ path }),
      (value) => {
        setWorkspaceState(value.workspaceState);
        openFileInPane(focusedPane, value.file);
      }
    );
  }, [focusedPane, openFileInPane, runner, setWorkspaceState]);

  const handleDeleteActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !relicClient.current) return;
    if (!window.confirm(t("files.deleteFileConfirm", { name: activeFile.tab.name }))) return;
    void runner.runWorkspaceMutation(
      [{ path: activeFile.tab.path, type: "file" }],
      () => relicClient.current!.moveItemToTrash({ path: activeFile.tab.path, type: "file" }),
      (value) => {
        closeTab(focusedPane, activeFile.tabId, false);
        setWorkspaceState(value);
      }
    );
  }, [closeTab, focusedPane, leftPane, rightPane, runner, setWorkspaceState, t, tabs]);

  const handleDeleteTreeItem = useCallback((path: string, type: WorkspaceTreeNode["type"]): void => {
    if (!relicClient.current || !window.confirm(deleteTreeItemMessage(path, type, t))) return;
    void runner.runWorkspaceMutation(
      [{ path, type }],
      () => relicClient.current!.moveItemToTrash({ path, type }),
      (value) => {
        tabCloseTargetsForTreeItem({ item: { path, type }, leftPane, rightPane, tabs })
          .forEach((target) => closeTab(target.pane, target.tabId, false));
        setWorkspaceState(value);
      }
    );
  }, [closeTab, leftPane, rightPane, runner, setWorkspaceState, t, tabs]);

  const handleDeleteTreeItems = useCallback((items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>): void => {
    if (!relicClient.current || items.length === 0) return;
    const deletableItems = removeCoveredItems(items);
    if (!window.confirm(deleteTreeItemsMessage(deletableItems.length, t))) return;

    void (async () => {
      if (!await runner.ensureCanMutateItems(deletableItems)) return;
      let nextWorkspaceState: WorkspaceState | null = null;
      const deletedItems: typeof deletableItems = [];
      for (const item of deletableItems) {
        const result = await relicClient.current!.moveItemToTrash({ path: item.path, type: item.type });
        if (!result.ok) {
          if (nextWorkspaceState) {
            closeDeletedTabs(deletedItems);
            setWorkspaceState(nextWorkspaceState);
          }
          setWorkspaceError(result.error.message);
          return;
        }
        deletedItems.push(item);
        nextWorkspaceState = result.value;
      }
      closeDeletedTabs(deletableItems);
      if (nextWorkspaceState) setWorkspaceState(nextWorkspaceState);
    })();
  }, [closeTab, leftPane, rightPane, runner, setWorkspaceError, setWorkspaceState, t, tabs]);

  const closeDeletedTabs = (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>): void => {
    tabCloseTargetsForTreeItems({ items, leftPane, rightPane, tabs })
      .forEach((target) => closeTab(target.pane, target.tabId, false));
  };

  return { handleDeleteActiveFile, handleDeleteTreeItem, handleDeleteTreeItems, handleDuplicateActiveFile, handleDuplicateTreeFile };
}
