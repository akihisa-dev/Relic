import { useCallback } from "react";

import type { LinkUpdateImpactKind } from "../../shared/ipcWorkspace";
import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
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
  movedFilePath,
  movedFolderPath,
  renamedFilePath,
  renamedFolderPath,
  tabCloseTargetsForTreeItem,
  tabCloseTargetsForTreeItems
} from "./workspaceFileMutationModel";

type WorkspaceFileMutationInput = Pick<
  WorkspaceFileActionsContext,
  | "beforeMutateWorkspaceItems"
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

const linkUpdateImpactFileThreshold = 30;
const linkUpdateImpactLinkThreshold = 100;

export function useWorkspaceFileMutationActions({
  beforeMutateWorkspaceItems,
  closeTab,
  focusedPane,
  leftPane,
  openFileInPane,
  rightPane,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  updateTabMeta,
  t
}: WorkspaceFileMutationInput & { t: Translator }) {
  const ensureCanMutateItems = useCallback(
    async (items: Array<{ path: string; type: "file" | "folder" }>): Promise<boolean> => {
      if (!beforeMutateWorkspaceItems) return true;
      return Promise.resolve(beforeMutateWorkspaceItems(items));
    },
    [beforeMutateWorkspaceItems]
  );

  const confirmLinkUpdateImpact = useCallback(
    async (kind: LinkUpdateImpactKind, oldPath: string, newPath: string): Promise<boolean> => {
      if (!window.relic || oldPath === newPath) return true;

      const result = await window.relic.getLinkUpdateImpact({ kind, newPath, oldPath });
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return false;
      }

      if (
        result.value.fileCount < linkUpdateImpactFileThreshold &&
        result.value.linkCount < linkUpdateImpactLinkThreshold
      ) {
        return true;
      }

      return window.confirm(t("links.updateImpactConfirm", {
        files: result.value.fileCount,
        links: result.value.linkCount
      }));
    },
    [setWorkspaceError, t]
  );

  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void (async () => {
      if (!await ensureCanMutateItems([{ path, type: "file" }])) return;
      if (!await confirmLinkUpdateImpact("file", path, movedFilePath(path, destFolder))) return;

      const result = await window.relic!.moveMarkdownFile({ destinationFolder: destFolder, path });
      if (result.ok) {
        const oldTab = Object.entries(tabs).find(([, tab]) => tab.kind === "file" && tab.path === path);

        if (oldTab) updateTabMeta(oldTab[0], { name: result.value.file.name, path: result.value.file.path });
        setWorkspaceState(result.value.workspaceState);
      } else {
        setWorkspaceError(result.error.message);
      }
    })();
  }, [confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void (async () => {
      if (!await ensureCanMutateItems([{ path, type: "folder" }])) return;
      if (!await confirmLinkUpdateImpact("folder", path, movedFolderPath(path, destFolder))) return;

      const result = await window.relic!.moveFolder({ destinationFolder: destFolder, path });
      if (result.ok) {
        const nextFolderPath = movedFolderPath(path, destFolder);

        buildFolderTabPathUpdates(tabs, path, nextFolderPath)
          .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    })();
  }, [confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]);

  const handleMoveTreeItems = useCallback(
    (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string): void => {
      if (!window.relic) return;

      const movableItems = getMovableTreeItems(items, destFolder);

      if (movableItems.length === 0) return;

      void (async () => {
        if (!await ensureCanMutateItems(movableItems)) return;
        const fileTabIdByPath = new Map<string, string>();
        for (const [tabId, tab] of Object.entries(tabs)) {
          if (tab.kind === "file") fileTabIdByPath.set(tab.path, tabId);
        }

        for (const item of movableItems) {
          if (item.type === "file") {
            if (!await confirmLinkUpdateImpact("file", item.path, movedFilePath(item.path, destFolder))) return;
            const result = await window.relic!.moveMarkdownFile({ destinationFolder: destFolder, path: item.path });
            if (!result.ok) {
              setWorkspaceError(result.error.message);
              return;
            }

            const oldTabId = fileTabIdByPath.get(item.path);

            if (oldTabId) updateTabMeta(oldTabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
            continue;
          }

          if (!await confirmLinkUpdateImpact("folder", item.path, movedFolderPath(item.path, destFolder))) return;
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
    [confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleMoveActiveFile = useCallback(
    (destinationFolder: string): void => {
      const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeFile || !window.relic) return;

      void (async () => {
        if (!await ensureCanMutateItems([{ path: activeFile.tab.path, type: "file" }])) return;
        if (!await confirmLinkUpdateImpact("file", activeFile.tab.path, movedFilePath(activeFile.tab.path, destinationFolder))) return;

        const result = await window.relic!.moveMarkdownFile({ destinationFolder, path: activeFile.tab.path });
          if (result.ok) {
            updateTabMeta(activeFile.tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        })();
    },
    [confirmLinkUpdateImpact, ensureCanMutateItems, focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleRenameActiveFile = useCallback(
    (newName: string): void => {
      const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeFile || !window.relic) return;

      void (async () => {
        if (!await ensureCanMutateItems([{ path: activeFile.tab.path, type: "file" }])) return;
        if (!await confirmLinkUpdateImpact("file", activeFile.tab.path, renamedFilePath(activeFile.tab.path, newName))) return;

        const result = await window.relic!.renameMarkdownFile({ newName, path: activeFile.tab.path });
          if (result.ok) {
            updateTabMeta(activeFile.tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        })();
    },
    [confirmLinkUpdateImpact, ensureCanMutateItems, focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleRenameTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"], newName: string): void => {
      if (!window.relic) return;

      if (type === "file") {
        void (async () => {
          if (!await ensureCanMutateItems([{ path, type: "file" }])) return;
          if (!await confirmLinkUpdateImpact("file", path, renamedFilePath(path, newName))) return;

          const result = await window.relic!.renameMarkdownFile({ newName, path });
          if (result.ok) {
            for (const [tabId, tab] of Object.entries(tabs)) {
              if (tab.kind === "file" && tab.path === path) {
                updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
              }
            }
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        })();
        return;
      }

      void (async () => {
        if (!await ensureCanMutateItems([{ path, type: "folder" }])) return;
        if (!await confirmLinkUpdateImpact("folder", path, renamedFolderPath(path, newName))) return;

        const result = await window.relic!.renameFolder({ newName, path });
        if (result.ok) {
          const nextFolderPath = renamedFolderPath(path, newName);

          buildFolderTabPathUpdates(tabs, path, nextFolderPath)
            .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })();
    },
    [confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError, setWorkspaceState, tabs, updateTabMeta]
  );

  const handleDuplicateActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !window.relic) return;
    void (async () => {
      if (!await ensureCanMutateItems([{ path: activeFile.tab.path, type: "file" }])) return;

      const result = await window.relic!.duplicateMarkdownFile({ path: activeFile.tab.path });
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    })();
  }, [ensureCanMutateItems, focusedPane, leftPane, openFileInPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]);

  const handleDuplicateTreeFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void (async () => {
        if (!await ensureCanMutateItems([{ path, type: "file" }])) return;

        const result = await window.relic!.duplicateMarkdownFile({ path });
        if (result.ok) {
          setWorkspaceState(result.value.workspaceState);
          openFileInPane(focusedPane, result.value.file);
        } else {
          setWorkspaceError(result.error.message);
        }
      })();
    },
    [ensureCanMutateItems, focusedPane, openFileInPane, setWorkspaceError, setWorkspaceState]
  );

  const handleDeleteActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !window.relic) return;
    if (!window.confirm(t("files.deleteFileConfirm", { name: activeFile.tab.name }))) return;
    void (async () => {
      if (!await ensureCanMutateItems([{ path: activeFile.tab.path, type: "file" }])) return;

      const result = await window.relic!.moveItemToTrash({ path: activeFile.tab.path, type: "file" });
      if (result.ok) {
        closeTab(focusedPane, activeFile.tabId);
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    })();
  }, [closeTab, ensureCanMutateItems, focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, t, tabs]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"]): void => {
      if (!window.relic) return;

      const message = deleteTreeItemMessage(path, type, t);
      if (!window.confirm(message)) return;

      void (async () => {
        if (!await ensureCanMutateItems([{ path, type }])) return;

        const result = await window.relic!.moveItemToTrash({ path, type });
        if (result.ok) {
          const item = { path, type };
          tabCloseTargetsForTreeItem({ item, leftPane, rightPane, tabs })
            .forEach((target) => closeTab(target.pane, target.tabId));
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })();
    },
    [closeTab, ensureCanMutateItems, leftPane, rightPane, setWorkspaceError, setWorkspaceState, t, tabs]
  );

  const handleDeleteTreeItems = useCallback(
    (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>): void => {
      if (!window.relic || items.length === 0) return;

      const deletableItems = removeCoveredItems(items);
      const itemCount = deletableItems.length;
      const message = deleteTreeItemsMessage(itemCount, t);
      if (!window.confirm(message)) return;

      void (async () => {
        if (!await ensureCanMutateItems(deletableItems)) return;

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
    [closeTab, ensureCanMutateItems, leftPane, rightPane, setWorkspaceError, setWorkspaceState, t, tabs]
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
