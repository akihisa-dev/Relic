import { useCallback } from "react";

import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import {
  buildFolderTabPathUpdates,
  getMovableTreeItems,
  removeCoveredItems
} from "./workspaceFileActionHelpers";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import {
  deleteTreeItemMessage,
  deleteTreeItemsMessage,
  getActiveFileTab,
  movedFolderPath,
  renamedFolderPath,
  tabCloseTargetsForTreeItem,
  tabCloseTargetsForTreeItems
} from "./workspaceFileMutationModel";

type WorkspaceFileMutationInput = Pick<
  WorkspaceFileActionsContext,
  | "closeTab"
  | "focusedPane"
  | "leftPane"
  | "openFileInPane"
  | "rightPane"
  | "setWorkspaceError"
  | "setWorkspaceState"
  | "tabs"
  | "updateTabMeta"
>;

export function useWorkspaceFileMutationActions({
  closeTab,
  focusedPane,
  leftPane,
  openFileInPane,
  rightPane,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  updateTabMeta
}: WorkspaceFileMutationInput) {
  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveMarkdownFile({ destinationFolder: destFolder, path }).then((result) => {
      if (result.ok) {
        const oldTab = Object.entries(tabs).find(([, tab]) => tab.kind === "file" && tab.path === path);

        if (oldTab) updateTabMeta(oldTab[0], { name: result.value.file.name, path: result.value.file.path });
        setWorkspaceState(result.value.workspaceState);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveFolder({ destinationFolder: destFolder, path }).then((result) => {
      if (result.ok) {
        const nextFolderPath = movedFolderPath(path, destFolder);

        buildFolderTabPathUpdates(tabs, path, nextFolderPath)
          .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]);

  const handleMoveTreeItems = useCallback(
    (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string): void => {
      if (!window.relic) return;

      const movableItems = getMovableTreeItems(items, destFolder);

      if (movableItems.length === 0) return;

      void (async () => {
        for (const item of movableItems) {
          if (item.type === "file") {
            const result = await window.relic!.moveMarkdownFile({ destinationFolder: destFolder, path: item.path });
            if (!result.ok) {
              setWorkspaceError(result.error.message);
              return;
            }

            const oldTab = Object.entries(tabs).find(([, tab]) => tab.kind === "file" && tab.path === item.path);

            if (oldTab) updateTabMeta(oldTab[0], { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
            continue;
          }

          const result = await window.relic!.moveFolder({ destinationFolder: destFolder, path: item.path });
          if (!result.ok) {
            setWorkspaceError(result.error.message);
            return;
          }

          const nextFolderPath = movedFolderPath(item.path, destFolder);

          buildFolderTabPathUpdates(tabs, item.path, nextFolderPath)
            .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
          setWorkspaceState(result.value);
        }
      })();
    },
    [setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleMoveActiveFile = useCallback(
    (destinationFolder: string): void => {
      const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeFile || !window.relic) return;

      void window.relic
        .moveMarkdownFile({ destinationFolder, path: activeFile.tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(activeFile.tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleRenameActiveFile = useCallback(
    (newName: string): void => {
      const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeFile || !window.relic) return;

      void window.relic
        .renameMarkdownFile({ newName, path: activeFile.tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(activeFile.tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleRenameTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"], newName: string): void => {
      if (!window.relic) return;

      if (type === "file") {
        void window.relic.renameMarkdownFile({ newName, path }).then((result) => {
          if (result.ok) {
            Object.entries(tabs)
              .filter(([, tab]) => tab.kind === "file" && tab.path === path)
              .forEach(([tabId]) => {
                updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
              });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
        return;
      }

      void window.relic.renameFolder({ newName, path }).then((result) => {
        if (result.ok) {
          const nextFolderPath = renamedFolderPath(path, newName);

          buildFolderTabPathUpdates(tabs, path, nextFolderPath)
            .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleDuplicateActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !window.relic) return;
    void window.relic.duplicateMarkdownFile({ path: activeFile.tab.path }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, leftPane, openFileInPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]);

  const handleDuplicateTreeFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void window.relic.duplicateMarkdownFile({ path }).then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value.workspaceState);
          openFileInPane(focusedPane, result.value.file);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [focusedPane, openFileInPane, setWorkspaceError, setWorkspaceState]
  );

  const handleDeleteActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !window.relic) return;
    if (!window.confirm(`「${activeFile.tab.name}」をゴミ箱に移動しますか？`)) return;
    void window.relic.moveItemToTrash({ path: activeFile.tab.path, type: "file" }).then((result) => {
      if (result.ok) {
        closeTab(focusedPane, activeFile.tabId);
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeTab, focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"]): void => {
      if (!window.relic) return;

      const message = deleteTreeItemMessage(path, type);
      if (!window.confirm(message)) return;

      void window.relic.moveItemToTrash({ path, type }).then((result) => {
        if (result.ok) {
          const item = { path, type };
          tabCloseTargetsForTreeItem({ item, leftPane, rightPane, tabs })
            .forEach((target) => closeTab(target.pane, target.tabId));
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [closeTab, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]
  );

  const handleDeleteTreeItems = useCallback(
    (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>): void => {
      if (!window.relic || items.length === 0) return;

      const deletableItems = removeCoveredItems(items);
      const itemCount = deletableItems.length;
      const message = deleteTreeItemsMessage(itemCount);
      if (!window.confirm(message)) return;

      void (async () => {
        let nextWorkspaceState: WorkspaceState | null = null;

        for (const item of deletableItems) {
          const result = await window.relic!.moveItemToTrash({ path: item.path, type: item.type });
          if (!result.ok) {
            setWorkspaceError(result.error.message);
            return;
          }
          nextWorkspaceState = result.value;
        }

        tabCloseTargetsForTreeItems({ items: deletableItems, leftPane, rightPane, tabs })
          .forEach((target) => closeTab(target.pane, target.tabId));

        if (nextWorkspaceState) setWorkspaceState(nextWorkspaceState);
      })();
    },
    [closeTab, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]
  );

  return {
    handleDeleteActiveFile,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateActiveFile,
    handleDuplicateTreeFile,
    handleMoveActiveFile,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleRenameActiveFile,
    handleRenameTreeItem
  };
}
