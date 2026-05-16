import { useCallback, useState } from "react";

import type { MarkdownFileContent, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { resolveMarkdownLinkPath, resolveWikiLinkPathWithAliases, type AliasIndex } from "../../shared/links";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";
import { displayNameFromPath, joinWorkspacePath, parentFolderOf } from "../workspacePaths";
import {
  buildFolderTabPathUpdates,
  findCreatedMarkdownPath,
  getMovableTreeItems,
  matchesAnyTreeItemPath,
  matchesTreeItemPath,
  nextUniqueFileName,
  nextUniqueFolderName,
  removeCoveredItems
} from "./workspaceFileActionHelpers";

interface UseWorkspaceFileActionsInput {
  closeAllTabs: () => void;
  closeTab: (pane: PaneId, tabId: string) => void;
  focusedPane: PaneId;
  leftPane: PaneState;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  aliasesByPath: AliasIndex;
  existingMarkdownPaths: string[];
  rightPane: PaneState;
  setLeftPaneScrollHeading: (heading: string | undefined) => void;
  setRightPaneScrollHeading: (heading: string | undefined) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  tabs: Record<string, Tab>;
  updateTabMeta: (tabId: string, meta: Pick<FileTab, "name" | "path">) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceFileActions({
  closeAllTabs,
  closeTab,
  focusedPane,
  leftPane,
  openFileInPane,
  aliasesByPath,
  existingMarkdownPaths,
  rightPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  updateTabMeta,
  workspaceState
}: UseWorkspaceFileActionsInput) {
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const handleOpenWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsOpeningWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .openWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsOpeningWorkspace(false));
  }, [setWorkspaceError, setWorkspaceState]);

  const handleCreateNewWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .createNewWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingWorkspace(false));
  }, [setWorkspaceError, setWorkspaceState]);

  const handleCreateFile = useCallback((): void => {
    if (!window.relic) return;

    const fileName = fileNameDraft.trim() || nextUniqueFileName(workspaceState);

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
          const expectedPath = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
          void window.relic!.readMarkdownFile({ path: expectedPath }).then((readResult) => {
            if (readResult.ok) {
              openFileInPane(focusedPane, readResult.value);
            }
          });
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFile(false));
  }, [
    fileNameDraft,
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  ]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!window.relic) return;

    const fileName = name.trim() || nextUniqueFileName(workspaceState);

    void window.relic
      .createMarkdownFile({ name: fileName })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          const expectedPath = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
          const newFile = findCreatedMarkdownPath(result.value.fileTree, expectedPath);

          if (newFile) {
            void window.relic!.readMarkdownFile({ path: newFile }).then((readResult) => {
              if (readResult.ok) openFileInPane(focusedPane, readResult.value);
            });
          }
        } else {
          setWorkspaceError(result.error.message);
        }
      });
  }, [
    focusedPane,
    openFileInPane,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  ]);

  const handleCreateFolder = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void window.relic
      .createFolder({ name: folderNameDraft.trim() || nextUniqueFolderName(workspaceState) })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFolder(false));
  }, [folderNameDraft, setWorkspaceError, setWorkspaceState, workspaceState]);

  const handleOpenFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTabId = paneState.activeTabId;
      const activeTab = activeTabId ? tabs[activeTabId] : null;

      if (activeTabId && activeTab?.kind === "file" && activeTab.path === path) {
        closeTab(focusedPane, activeTabId);
        return;
      }

      void window.relic.readMarkdownFile({ path }).then((result) => {
        if (result.ok) {
          openFileInPane(focusedPane, result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [closeTab, focusedPane, leftPane, openFileInPane, rightPane, setWorkspaceError, tabs]
  );

  const handleOpenWikiLink = useCallback(
    (target: string, heading?: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || activeTab.kind !== "file" || !window.relic) return;

      const path = resolveWikiLinkPathWithAliases(target, activeTab.path, existingMarkdownPaths, aliasesByPath);
      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownFile({ path }).then((readResult) => {
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (heading) setScrollHeading(heading);
          return;
        }

        void window.relic!.createLinkedMarkdownFile({ path }).then((createResult) => {
          if (createResult.ok) {
            setWorkspaceState(createResult.value.workspaceState);
            openFileInPane(focusedPane, createResult.value.file);
          } else {
            setWorkspaceError(createResult.error.message);
          }
        });
      });
    },
    [
      focusedPane,
      aliasesByPath,
      existingMarkdownPaths,
      leftPane,
      openFileInPane,
      rightPane,
      setLeftPaneScrollHeading,
      setRightPaneScrollHeading,
      setWorkspaceError,
      setWorkspaceState,
      tabs
    ]
  );

  const handleOpenMarkdownLink = useCallback(
    (href: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || activeTab.kind !== "file" || !window.relic) return;

      const resolved = resolveMarkdownLinkPath(href, activeTab.path);
      if (!resolved) return;

      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownFile({ path: resolved.path }).then((readResult) => {
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (resolved.heading) setScrollHeading(resolved.heading);
          return;
        }

        void window.relic!.createLinkedMarkdownFile({ path: resolved.path }).then((createResult) => {
          if (createResult.ok) {
            setWorkspaceState(createResult.value.workspaceState);
            openFileInPane(focusedPane, createResult.value.file);
            if (resolved.heading) setScrollHeading(resolved.heading);
          } else {
            setWorkspaceError(createResult.error.message);
          }
        });
      });
    },
    [
      focusedPane,
      leftPane,
      openFileInPane,
      rightPane,
      setLeftPaneScrollHeading,
      setRightPaneScrollHeading,
      setWorkspaceError,
      setWorkspaceState,
      tabs
    ]
  );

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    if (!window.relic) return;

    void window.relic.switchWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        closeAllTabs();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleRemoveWorkspace = useCallback((workspaceId: string): void => {
    if (!window.relic) return;

    void window.relic.removeWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        closeAllTabs();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleRenameWorkspace = useCallback(async (workspaceId: string, name: string): Promise<boolean> => {
    if (!window.relic) return false;

    const result = await window.relic.renameWorkspace({ name, workspaceId });
    if (result.ok) {
      setWorkspaceState(result.value);
      return true;
    }

    setWorkspaceError(result.error.message);
    return false;
  }, [setWorkspaceError, setWorkspaceState]);

  const handleRefreshWorkspaceState = useCallback((): void => {
    void window.relic?.getWorkspaceState().then((result) => {
      if (result.ok) setWorkspaceState(result.value);
    });
  }, [setWorkspaceState]);

  const handleTogglePin = useCallback((path: string): void => {
    if (!window.relic) return;

    void window.relic.togglePin(path).then((result) => {
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError, setWorkspaceState]);

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
        const nextFolderPath = joinWorkspacePath(destFolder, displayNameFromPath(path));

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

          const nextFolderPath = joinWorkspacePath(destFolder, displayNameFromPath(item.path));

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
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const tabId = paneState.activeTabId;

      if (!tabId || !window.relic) return;

      const tab = tabs[tabId];

      if (!tab || tab.kind !== "file") return;

      void window.relic
        .moveMarkdownFile({ destinationFolder, path: tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
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
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const tabId = paneState.activeTabId;

      if (!tabId || !window.relic) return;

      const tab = tabs[tabId];

      if (!tab || tab.kind !== "file") return;

      void window.relic
        .renameMarkdownFile({ newName, path: tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
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
          const nextFolderPath = joinWorkspacePath(parentFolderOf(path), newName);

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
    const paneState = focusedPane === "left" ? leftPane : rightPane;
    const tabId = paneState.activeTabId;
    if (!tabId || !window.relic) return;
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    void window.relic.duplicateMarkdownFile({ path: tab.path }).then((result) => {
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
    const paneState = focusedPane === "left" ? leftPane : rightPane;
    const tabId = paneState.activeTabId;
    if (!tabId || !window.relic) return;
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    if (!window.confirm(`「${tab.name}」をゴミ箱に移動しますか？`)) return;
    void window.relic.moveItemToTrash({ path: tab.path, type: "file" }).then((result) => {
      if (result.ok) {
        closeTab(focusedPane, tabId);
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeTab, focusedPane, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"]): void => {
      if (!window.relic) return;

      const name = displayNameFromPath(path);
      const message = type === "folder"
        ? `「${name}」フォルダをゴミ箱に移動しますか？フォルダ内のノートやファイルも一緒に移動されます。`
        : `「${name}」をゴミ箱に移動しますか？`;
      if (!window.confirm(message)) return;

      void window.relic.moveItemToTrash({ path, type }).then((result) => {
        if (result.ok) {
          const item = { path, type };

          leftPane.tabIds.forEach((tabId) => {
            const tab = tabs[tabId];
            if (tab?.kind === "file" && matchesTreeItemPath(tab.path, item)) closeTab("left", tabId);
          });
          rightPane.tabIds.forEach((tabId) => {
            const tab = tabs[tabId];
            if (tab?.kind === "file" && matchesTreeItemPath(tab.path, item)) closeTab("right", tabId);
          });
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
      const message = `${itemCount}件の項目をゴミ箱に移動しますか？フォルダを含む場合、フォルダ内のノートやファイルも一緒に移動されます。`;
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

        leftPane.tabIds.forEach((tabId) => {
          const tab = tabs[tabId];
          if (tab?.kind === "file" && matchesAnyTreeItemPath(tab.path, deletableItems)) closeTab("left", tabId);
        });
        rightPane.tabIds.forEach((tabId) => {
          const tab = tabs[tabId];
          if (tab?.kind === "file" && matchesAnyTreeItemPath(tab.path, deletableItems)) closeTab("right", tabId);
        });

        if (nextWorkspaceState) setWorkspaceState(nextWorkspaceState);
      })();
    },
    [closeTab, leftPane, rightPane, setWorkspaceError, setWorkspaceState, tabs]
  );

  return {
    fileNameDraft,
    folderNameDraft,
    handleDeleteActiveFile,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateActiveFile,
    handleDuplicateTreeFile,
    handleCreateFile,
    handleCreateFolder,
    handleCreateNewWorkspace,
    handleCreateNoteFromPane,
    handleOpenFile,
    handleOpenMarkdownLink,
    handleOpenWikiLink,
    handleOpenWorkspace,
    handleRefreshWorkspaceState,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleMoveActiveFile,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleRenameActiveFile,
    handleRenameTreeItem,
    handleTogglePin,
    isCreatingFile,
    isCreatingFolder,
    isCreatingWorkspace,
    isOpeningWorkspace,
    setFileNameDraft,
    setFolderNameDraft,
    setIsCreatingFile
  };
}
