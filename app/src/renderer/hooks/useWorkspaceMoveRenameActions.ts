import { useCallback } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { relicClient } from "../relicClient";
import { getMovableTreeItems, removeCoveredItems } from "./workspaceFileActionHelpers";
import type {
  UpdateMovedFileTab,
  UpdateMovedFolderTabs,
  WorkspaceFileMutationInput,
  WorkspaceMutationRunner
} from "./workspaceFileMutationShared";
import {
  getActiveFileTab,
  movedFilePath,
  movedFolderPath,
  renamedFilePath,
  renamedFolderPath
} from "./workspaceFileMutationModel";

interface UseWorkspaceMoveRenameActionsInput extends WorkspaceFileMutationInput {
  runner: WorkspaceMutationRunner;
  updateMovedFileTab: UpdateMovedFileTab;
  updateMovedFolderTabs: UpdateMovedFolderTabs;
}

export function useWorkspaceMoveRenameActions({
  focusedPane,
  leftPane,
  rightPane,
  runner,
  setWorkspaceState,
  tabs,
  updateMovedFileTab,
  updateMovedFolderTabs
}: UseWorkspaceMoveRenameActionsInput) {
  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path, type: "file" }],
      () => relicClient.current!.moveMarkdownFile({ destinationFolder: destFolder, path }),
      (value) => {
        updateMovedFileTab(path, value.file);
        setWorkspaceState(value.workspaceState);
      },
      { kind: "file", oldPath: path, newPath: movedFilePath(path, destFolder) }
    );
  }, [runner, setWorkspaceState, updateMovedFileTab]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!relicClient.current) return;
    const nextFolderPath = movedFolderPath(path, destFolder);
    void runner.runWorkspaceMutation(
      [{ path, type: "folder" }],
      () => relicClient.current!.moveFolder({ destinationFolder: destFolder, path }),
      (value) => {
        updateMovedFolderTabs(path, nextFolderPath);
        setWorkspaceState(value);
      },
      { kind: "folder", oldPath: path, newPath: nextFolderPath }
    );
  }, [runner, setWorkspaceState, updateMovedFolderTabs]);

  const handleMoveTreeItems = useCallback((
    items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>,
    destFolder: string
  ): void => {
    if (!relicClient.current) return;
    const movableItems = getMovableTreeItems(items, destFolder);
    if (movableItems.length === 0 || movableItems.length !== removeCoveredItems(items).length) return;

    void (async () => {
      if (!await runner.ensureCanMutateItems(movableItems)) return;
      const fileTabIdByPath = new Map<string, string>();
      for (const [tabId, tab] of Object.entries(tabs)) if (tab.kind === "file") fileTabIdByPath.set(tab.path, tabId);
      for (const item of movableItems) {
        if (item.type === "file") {
          const moved = await runner.runWorkspaceMutation(
            [item],
            () => relicClient.current!.moveMarkdownFile({ destinationFolder: destFolder, path: item.path }),
            (value) => {
              updateMovedFileTab(item.path, value.file, fileTabIdByPath.get(item.path));
              setWorkspaceState(value.workspaceState);
            },
            { kind: "file", oldPath: item.path, newPath: movedFilePath(item.path, destFolder) },
            { skipItemGuard: true }
          );
          if (!moved) return;
        } else {
          const nextFolderPath = movedFolderPath(item.path, destFolder);
          const moved = await runner.runWorkspaceMutation(
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
      }
    })();
  }, [runner, setWorkspaceState, tabs, updateMovedFileTab, updateMovedFolderTabs]);

  const activeFile = () => getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
  const handleMoveActiveFile = useCallback((destinationFolder: string): void => {
    const active = activeFile();
    if (!active || !relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path: active.tab.path, type: "file" }],
      () => relicClient.current!.moveMarkdownFile({ destinationFolder, path: active.tab.path }),
      (value) => {
        updateMovedFileTab(active.tab.path, value.file, active.tabId);
        setWorkspaceState(value.workspaceState);
      },
      { kind: "file", oldPath: active.tab.path, newPath: movedFilePath(active.tab.path, destinationFolder) }
    );
  }, [focusedPane, leftPane, rightPane, runner, setWorkspaceState, tabs, updateMovedFileTab]);

  const handleRenameActiveFile = useCallback((newName: string): void => {
    const active = activeFile();
    if (!active || !relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path: active.tab.path, type: "file" }],
      () => relicClient.current!.renameMarkdownFile({ newName, path: active.tab.path }),
      (value) => {
        updateMovedFileTab(active.tab.path, value.file, active.tabId);
        setWorkspaceState(value.workspaceState);
      },
      { kind: "file", oldPath: active.tab.path, newPath: renamedFilePath(active.tab.path, newName) }
    );
  }, [focusedPane, leftPane, rightPane, runner, setWorkspaceState, tabs, updateMovedFileTab]);

  const handleRenameTreeItem = useCallback((path: string, type: WorkspaceTreeNode["type"], newName: string): void => {
    if (!relicClient.current) return;
    if (type === "file") {
      void runner.runWorkspaceMutation(
        [{ path, type: "file" }],
        () => relicClient.current!.renameMarkdownFile({ newName, path }),
        (value) => {
          updateMovedFileTab(path, value.file);
          setWorkspaceState(value.workspaceState);
        },
        { kind: "file", oldPath: path, newPath: renamedFilePath(path, newName) }
      );
      return;
    }
    const nextFolderPath = renamedFolderPath(path, newName);
    void runner.runWorkspaceMutation(
      [{ path, type: "folder" }],
      () => relicClient.current!.renameFolder({ newName, path }),
      (value) => {
        updateMovedFolderTabs(path, nextFolderPath);
        setWorkspaceState(value);
      },
      { kind: "folder", oldPath: path, newPath: nextFolderPath }
    );
  }, [runner, setWorkspaceState, updateMovedFileTab, updateMovedFolderTabs]);

  return { handleMoveActiveFile, handleMoveFile, handleMoveFolder, handleMoveTreeItems, handleRenameActiveFile, handleRenameTreeItem };
}
