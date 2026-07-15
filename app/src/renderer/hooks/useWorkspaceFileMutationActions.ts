import { relicClient } from "../relicClient";
import { useCallback } from "react";

import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import type { Translator } from "../i18nModel";
import {
  buildFolderTabPathUpdates,
  getMovableTreeItems,
  removeCoveredItems
} from "./workspaceFileActionHelpers";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import { useWorkspaceMutationRunner } from "./useWorkspaceMutationRunner";
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
  | "openImageInPane"
  | "rightPane"
  | "setWorkspaceError"
  | "setWorkspaceState"
  | "tabs"
  | "updateTabMeta"
>;

interface DroppedWorkspaceFiles {
  imageSourcePaths: string[];
  markdownSourcePaths: string[];
}

function fileTabIdForPath(tabs: WorkspaceFileMutationInput["tabs"], path: string): string | null {
  const tabEntry = Object.entries(tabs).find(([, tab]) => tab.kind === "file" && tab.path === path);
  return tabEntry?.[0] ?? null;
}

function splitDroppedWorkspaceFiles(sourcePaths: string[]): DroppedWorkspaceFiles {
  const imageSourcePaths: string[] = [];
  const markdownSourcePaths: string[] = [];

  for (const sourcePath of sourcePaths) {
    if (hasMarkdownExtension(sourcePath)) {
      markdownSourcePaths.push(sourcePath);
    } else if (isSupportedMarkdownImagePath(sourcePath)) {
      imageSourcePaths.push(sourcePath);
    } else {
      markdownSourcePaths.push(sourcePath);
    }
  }

  return { imageSourcePaths, markdownSourcePaths };
}

export function useWorkspaceFileMutationActions({
  beforeMutateWorkspaceItems,
  closeTab,
  focusedPane,
  leftPane,
  openFileInPane,
  openImageInPane,
  rightPane,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  updateTabMeta,
  t
}: WorkspaceFileMutationInput & { t: Translator }) {
  const { ensureCanMutateItems, runWorkspaceMutation } = useWorkspaceMutationRunner({
    beforeMutateWorkspaceItems,
    setWorkspaceError,
    t
  });

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
    if (!relicClient.current) return;

    void (async () => {
      await runWorkspaceMutation(
        [{ path, type: "file" }],
        () => relicClient.current!.moveMarkdownFile({ destinationFolder: destFolder, path }),
        (value) => {
          updateMovedFileTab(path, value.file);
          setWorkspaceState(value.workspaceState);
        },
        { kind: "file", oldPath: path, newPath: movedFilePath(path, destFolder) }
      );
    })();
  }, [runWorkspaceMutation, setWorkspaceState, updateMovedFileTab]);

  const handleImportMarkdownFiles = useCallback((sourcePaths: string[], destinationFolder: string): void => {
    if (!relicClient.current || sourcePaths.length === 0) return;

    const { imageSourcePaths, markdownSourcePaths } = splitDroppedWorkspaceFiles(sourcePaths);

    void (async () => {
      if (markdownSourcePaths.length > 0) {
        const result = await relicClient.current!.importMarkdownFiles({
          destinationFolder,
          sourcePaths: markdownSourcePaths
        });
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }
        setWorkspaceState(result.value);
      }

      const importedImagePaths: string[] = [];
      for (const sourcePath of imageSourcePaths) {
        const result = await relicClient.current!.importImageFile({ destinationFolder, sourcePath });
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }
        importedImagePaths.push(result.value.path);
      }

      if (importedImagePaths.length > 0) {
        const stateResult = await relicClient.current!.getWorkspaceState();
        if (stateResult.ok) setWorkspaceState(stateResult.value);
      }

      for (const imagePath of importedImagePaths) {
        openImageInPane(focusedPane, { name: imagePath.split("/").at(-1) ?? imagePath, path: imagePath });
      }
    })();
  }, [focusedPane, openImageInPane, setWorkspaceError, setWorkspaceState]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!relicClient.current) return;

    void (async () => {
      const nextFolderPath = movedFolderPath(path, destFolder);
      await runWorkspaceMutation(
        [{ path, type: "folder" }],
        () => relicClient.current!.moveFolder({ destinationFolder: destFolder, path }),
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
      if (!relicClient.current) return;

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
              () => relicClient.current!.moveMarkdownFile({ destinationFolder: destFolder, path: item.path }),
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
            () => relicClient.current!.moveFolder({ destinationFolder: destFolder, path: item.path }),
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

      if (!activeFile || !relicClient.current) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path: activeFile.tab.path, type: "file" }],
          () => relicClient.current!.moveMarkdownFile({ destinationFolder, path: activeFile.tab.path }),
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

      if (!activeFile || !relicClient.current) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path: activeFile.tab.path, type: "file" }],
          () => relicClient.current!.renameMarkdownFile({ newName, path: activeFile.tab.path }),
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
      if (!relicClient.current) return;

      if (type === "file") {
        void (async () => {
          await runWorkspaceMutation(
            [{ path, type: "file" }],
            () => relicClient.current!.renameMarkdownFile({ newName, path }),
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
          () => relicClient.current!.renameFolder({ newName, path }),
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
    if (!activeFile || !relicClient.current) return;
    void (async () => {
      await runWorkspaceMutation(
        [{ path: activeFile.tab.path, type: "file" }],
        () => relicClient.current!.duplicateMarkdownFile({ path: activeFile.tab.path }),
        (value) => {
          setWorkspaceState(value.workspaceState);
          openFileInPane(focusedPane, value.file);
        }
      );
    })();
  }, [focusedPane, leftPane, openFileInPane, rightPane, runWorkspaceMutation, setWorkspaceState, tabs]);

  const handleDuplicateTreeFile = useCallback(
    (path: string): void => {
      if (!relicClient.current) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path, type: "file" }],
          () => relicClient.current!.duplicateMarkdownFile({ path }),
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
    if (!activeFile || !relicClient.current) return;
    if (!window.confirm(t("files.deleteFileConfirm", { name: activeFile.tab.name }))) return;
    void (async () => {
      await runWorkspaceMutation(
        [{ path: activeFile.tab.path, type: "file" }],
        () => relicClient.current!.moveItemToTrash({ path: activeFile.tab.path, type: "file" }),
        (value) => {
          closeTab(focusedPane, activeFile.tabId);
          setWorkspaceState(value);
        }
      );
    })();
  }, [closeTab, focusedPane, leftPane, rightPane, runWorkspaceMutation, setWorkspaceState, t, tabs]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"]): void => {
      if (!relicClient.current) return;

      const message = deleteTreeItemMessage(path, type, t);
      if (!window.confirm(message)) return;

      void (async () => {
        await runWorkspaceMutation(
          [{ path, type }],
          () => relicClient.current!.moveItemToTrash({ path, type }),
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
      if (!relicClient.current || items.length === 0) return;

      const deletableItems = removeCoveredItems(items);
      const itemCount = deletableItems.length;
      const message = deleteTreeItemsMessage(itemCount, t);
      if (!window.confirm(message)) return;

      void (async () => {
        if (!await ensureCanMutateItems(deletableItems)) return;

        let nextWorkspaceState: WorkspaceState | null = null;

        for (const item of deletableItems) {
          const result = await relicClient.current!.moveItemToTrash({ path: item.path, type: item.type });
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
    handleImportMarkdownFiles,
    handleMoveActiveFile,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleRenameActiveFile,
    handleRenameTreeItem
  };
}
