import { useCallback } from "react";

import type { LinkUpdateImpactKind } from "../../shared/ipcWorkspace";
import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
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

type WorkspaceMutationItem = { path: string; type: WorkspaceTreeNode["type"] };

interface LinkImpactRequest {
  kind: LinkUpdateImpactKind;
  newPath: string;
  oldPath: string;
}

const linkUpdateImpactFileThreshold = 30;
const linkUpdateImpactLinkThreshold = 100;

function fileTabIdForPath(tabs: WorkspaceFileMutationInput["tabs"], path: string): string | null {
  const tabEntry = Object.entries(tabs).find(([, tab]) => tab.kind === "file" && tab.path === path);
  return tabEntry?.[0] ?? null;
}

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

  const runWorkspaceMutation = useCallback(
    async <T,>(
      items: WorkspaceMutationItem[],
      action: () => Promise<RelicResult<T>>,
      onSuccess: (value: T) => void,
      linkImpact?: LinkImpactRequest,
      options?: { skipItemGuard?: boolean }
    ): Promise<boolean> => {
      if (!options?.skipItemGuard && !await ensureCanMutateItems(items)) return false;
      if (linkImpact && !await confirmLinkUpdateImpact(linkImpact.kind, linkImpact.oldPath, linkImpact.newPath)) {
        return false;
      }

      const result = await action();
      if (result.ok) {
        onSuccess(result.value);
        return true;
      }

      setWorkspaceError(result.error.message);
      return false;
    },
    [confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError]
  );

  const updateMovedFileTab = useCallback(
    (oldPath: string, file: { name: string; path: string }, preferredTabId?: string): void => {
      const tabId = preferredTabId ?? fileTabIdForPath(tabs, oldPath);
      if (tabId) updateTabMeta(tabId, { name: file.name, path: file.path });
    },
    [tabs, updateTabMeta]
  );

  const updateMovedFolderTabs = useCallback(
    (oldPath: string, newPath: string): void => {
      buildFolderTabPathUpdates(tabs, oldPath, newPath)
        .forEach((update) => updateTabMeta(update.tabId, { name: update.name, path: update.path }));
    },
    [tabs, updateTabMeta]
  );

  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void (async () => {
      await runWorkspaceMutation(
        [{ path, type: "file" }],
        () => window.relic!.moveMarkdownFile({ destinationFolder: destFolder, path }),
        (value) => {
          updateMovedFileTab(path, value.file);
          setWorkspaceState(value.workspaceState);
        },
        { kind: "file", oldPath: path, newPath: movedFilePath(path, destFolder) }
      );
    })();
  }, [runWorkspaceMutation, setWorkspaceState, updateMovedFileTab]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void (async () => {
      const nextFolderPath = movedFolderPath(path, destFolder);
      await runWorkspaceMutation(
        [{ path, type: "folder" }],
        () => window.relic!.moveFolder({ destinationFolder: destFolder, path }),
        (value) => {
          updateMovedFolderTabs(path, nextFolderPath);
          setWorkspaceState(value);
        },
        { kind: "folder", oldPath: path, newPath: nextFolderPath }
      );
    })();
  }, [runWorkspaceMutation, setWorkspaceState, updateMovedFolderTabs]);

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
            const oldTabId = fileTabIdByPath.get(item.path);
            const moved = await runWorkspaceMutation(
              [item],
              () => window.relic!.moveMarkdownFile({ destinationFolder: destFolder, path: item.path }),
              (value) => {
                updateMovedFileTab(item.path, value.file, oldTabId);
                setWorkspaceState(value.workspaceState);
              },
              { kind: "file", oldPath: item.path, newPath: movedFilePath(item.path, destFolder) },
              { skipItemGuard: true }
            );
            if (!moved) return;
            continue;
          }

          const nextFolderPath = movedFolderPath(item.path, destFolder);
          const moved = await runWorkspaceMutation(
            [item],
            () => window.relic!.moveFolder({ destinationFolder: destFolder, path: item.path }),
            (value) => {
              updateMovedFolderTabs(item.path, nextFolderPath);
              setWorkspaceState(value);
            },
            { kind: "folder", oldPath: item.path, newPath: nextFolderPath },
            { skipItemGuard: true }
          );
          if (!moved) return;
        }
      })();
    },
    [ensureCanMutateItems, runWorkspaceMutation, setWorkspaceState, tabs, updateMovedFileTab, updateMovedFolderTabs]
  );

  const handleMoveActiveFile = useCallback(
    (destinationFolder: string): void => {
      const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeFile || !window.relic) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path: activeFile.tab.path, type: "file" }],
          () => window.relic!.moveMarkdownFile({ destinationFolder, path: activeFile.tab.path }),
          (value) => {
            updateMovedFileTab(activeFile.tab.path, value.file, activeFile.tabId);
            setWorkspaceState(value.workspaceState);
          },
          { kind: "file", oldPath: activeFile.tab.path, newPath: movedFilePath(activeFile.tab.path, destinationFolder) }
        );
      })();
    },
    [focusedPane, leftPane, rightPane, runWorkspaceMutation, setWorkspaceState, tabs, updateMovedFileTab]
  );

  const handleRenameActiveFile = useCallback(
    (newName: string): void => {
      const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });

      if (!activeFile || !window.relic) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path: activeFile.tab.path, type: "file" }],
          () => window.relic!.renameMarkdownFile({ newName, path: activeFile.tab.path }),
          (value) => {
            updateMovedFileTab(activeFile.tab.path, value.file, activeFile.tabId);
            setWorkspaceState(value.workspaceState);
          },
          { kind: "file", oldPath: activeFile.tab.path, newPath: renamedFilePath(activeFile.tab.path, newName) }
        );
      })();
    },
    [focusedPane, leftPane, rightPane, runWorkspaceMutation, setWorkspaceState, tabs, updateMovedFileTab]
  );

  const handleRenameTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"], newName: string): void => {
      if (!window.relic) return;

      if (type === "file") {
        void (async () => {
          await runWorkspaceMutation(
            [{ path, type: "file" }],
            () => window.relic!.renameMarkdownFile({ newName, path }),
            (value) => {
              updateMovedFileTab(path, value.file);
              setWorkspaceState(value.workspaceState);
            },
            { kind: "file", oldPath: path, newPath: renamedFilePath(path, newName) }
          );
        })();
        return;
      }

      void (async () => {
        const nextFolderPath = renamedFolderPath(path, newName);
        await runWorkspaceMutation(
          [{ path, type: "folder" }],
          () => window.relic!.renameFolder({ newName, path }),
          (value) => {
            updateMovedFolderTabs(path, nextFolderPath);
            setWorkspaceState(value);
          },
          { kind: "folder", oldPath: path, newPath: nextFolderPath }
        );
      })();
    },
    [runWorkspaceMutation, setWorkspaceState, updateMovedFileTab, updateMovedFolderTabs]
  );

  const handleDuplicateActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !window.relic) return;
    void (async () => {
      await runWorkspaceMutation(
        [{ path: activeFile.tab.path, type: "file" }],
        () => window.relic!.duplicateMarkdownFile({ path: activeFile.tab.path }),
        (value) => {
          setWorkspaceState(value.workspaceState);
          openFileInPane(focusedPane, value.file);
        }
      );
    })();
  }, [focusedPane, leftPane, openFileInPane, rightPane, runWorkspaceMutation, setWorkspaceState, tabs]);

  const handleDuplicateTreeFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path, type: "file" }],
          () => window.relic!.duplicateMarkdownFile({ path }),
          (value) => {
            setWorkspaceState(value.workspaceState);
            openFileInPane(focusedPane, value.file);
          }
        );
      })();
    },
    [focusedPane, openFileInPane, runWorkspaceMutation, setWorkspaceState]
  );

  const handleDeleteActiveFile = useCallback((): void => {
    const activeFile = getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
    if (!activeFile || !window.relic) return;
    if (!window.confirm(t("files.deleteFileConfirm", { name: activeFile.tab.name }))) return;
    void (async () => {
      await runWorkspaceMutation(
        [{ path: activeFile.tab.path, type: "file" }],
        () => window.relic!.moveItemToTrash({ path: activeFile.tab.path, type: "file" }),
        (value) => {
          closeTab(focusedPane, activeFile.tabId);
          setWorkspaceState(value);
        }
      );
    })();
  }, [closeTab, focusedPane, leftPane, rightPane, runWorkspaceMutation, setWorkspaceState, t, tabs]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"]): void => {
      if (!window.relic) return;

      const message = deleteTreeItemMessage(path, type, t);
      if (!window.confirm(message)) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path, type }],
          () => window.relic!.moveItemToTrash({ path, type }),
          (value) => {
            const item = { path, type };
            tabCloseTargetsForTreeItem({ item, leftPane, rightPane, tabs })
              .forEach((target) => closeTab(target.pane, target.tabId));
            setWorkspaceState(value);
          }
        );
      })();
    },
    [closeTab, leftPane, rightPane, runWorkspaceMutation, setWorkspaceState, t, tabs]
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
