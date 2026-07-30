import { useCallback } from "react";

import type {
  MarkdownFileRelocationRecovery,
  RelocateMarkdownFileResult,
  WorkspaceTreeNode
} from "../../shared/ipc";
import type { Translator } from "../i18nModel";
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
  t: Translator;
  updateMovedFileTab: UpdateMovedFileTab;
  updateMovedFolderTabs: UpdateMovedFolderTabs;
}

export function useWorkspaceMoveRenameActions({
  focusedPane,
  leftPane,
  rightPane,
  runner,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  t,
  updateMovedFileTab,
  updateMovedFolderTabs
}: UseWorkspaceMoveRenameActionsInput) {
  const relocationOptions = (
    oldPath: string,
    preferredTabId?: string
  ): {
    isComplete: (value: RelocateMarkdownFileResult) => boolean;
    onIncomplete: (value: RelocateMarkdownFileResult) => void;
  } => ({
    isComplete: isCompletedRelocation,
    onIncomplete: (value) => {
      if (!("recovery" in value)) return;
      setWorkspaceState(value.workspaceState);
      if (value.recovery.currentPath && value.recovery.currentPath !== oldPath) {
        updateMovedFileTab(oldPath, {
          name: pathName(value.recovery.currentPath),
          path: value.recovery.currentPath
        }, preferredTabId);
      }
      setWorkspaceError(fileRelocationRecoveryMessage(value.status, value.recovery, t));
    }
  });

  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path, type: "file" }],
      () => relicClient.current!.moveMarkdownFile({ destinationFolder: destFolder, path }),
      (value) => {
        if (!isCompletedRelocation(value)) return;
        updateMovedFileTab(path, value.file);
        setWorkspaceState(value.workspaceState);
      },
      { kind: "file", oldPath: path, newPath: movedFilePath(path, destFolder) },
      relocationOptions(path)
    );
  }, [runner, setWorkspaceError, setWorkspaceState, t, updateMovedFileTab]);

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
      const isCurrentWorkspace = runner.beginWorkspaceRequest();
      if (!await runner.ensureCanMutateItems(movableItems, isCurrentWorkspace)) return;
      const fileTabIdByPath = new Map<string, string>();
      for (const [tabId, tab] of Object.entries(tabs)) if (tab.kind === "file") fileTabIdByPath.set(tab.path, tabId);
      for (const item of movableItems) {
        if (item.type === "file") {
          const moved = await runner.runWorkspaceMutation(
            [item],
            () => relicClient.current!.moveMarkdownFile({ destinationFolder: destFolder, path: item.path }),
            (value) => {
              if (!isCompletedRelocation(value)) return;
              updateMovedFileTab(item.path, value.file, fileTabIdByPath.get(item.path));
              setWorkspaceState(value.workspaceState);
            },
            { kind: "file", oldPath: item.path, newPath: movedFilePath(item.path, destFolder) },
            {
              ...relocationOptions(item.path, fileTabIdByPath.get(item.path)),
              isCurrentWorkspace,
              skipItemGuard: true
            }
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
            { isCurrentWorkspace, skipItemGuard: true }
          );
          if (!moved) return;
        }
      }
    })();
  }, [
    runner,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs,
    updateMovedFileTab,
    updateMovedFolderTabs
  ]);

  const activeFile = () => getActiveFileTab({ focusedPane, leftPane, rightPane, tabs });
  const handleMoveActiveFile = useCallback((destinationFolder: string): void => {
    const active = activeFile();
    if (!active || !relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path: active.tab.path, type: "file" }],
      () => relicClient.current!.moveMarkdownFile({ destinationFolder, path: active.tab.path }),
      (value) => {
        if (!isCompletedRelocation(value)) return;
        updateMovedFileTab(active.tab.path, value.file, active.tabId);
        setWorkspaceState(value.workspaceState);
      },
      { kind: "file", oldPath: active.tab.path, newPath: movedFilePath(active.tab.path, destinationFolder) },
      relocationOptions(active.tab.path, active.tabId)
    );
  }, [
    focusedPane,
    leftPane,
    rightPane,
    runner,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs,
    updateMovedFileTab
  ]);

  const handleRenameActiveFile = useCallback((newName: string): void => {
    const active = activeFile();
    if (!active || !relicClient.current) return;
    void runner.runWorkspaceMutation(
      [{ path: active.tab.path, type: "file" }],
      () => relicClient.current!.renameMarkdownFile({ newName, path: active.tab.path }),
      (value) => {
        if (!isCompletedRelocation(value)) return;
        updateMovedFileTab(active.tab.path, value.file, active.tabId);
        setWorkspaceState(value.workspaceState);
      },
      { kind: "file", oldPath: active.tab.path, newPath: renamedFilePath(active.tab.path, newName) },
      relocationOptions(active.tab.path, active.tabId)
    );
  }, [
    focusedPane,
    leftPane,
    rightPane,
    runner,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs,
    updateMovedFileTab
  ]);

  const handleRenameTreeItem = useCallback((path: string, type: WorkspaceTreeNode["type"], newName: string): void => {
    if (!relicClient.current) return;
    if (type === "file") {
      void runner.runWorkspaceMutation(
        [{ path, type: "file" }],
        () => relicClient.current!.renameMarkdownFile({ newName, path }),
        (value) => {
          if (!isCompletedRelocation(value)) return;
          updateMovedFileTab(path, value.file);
          setWorkspaceState(value.workspaceState);
        },
        { kind: "file", oldPath: path, newPath: renamedFilePath(path, newName) },
        relocationOptions(path)
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
  }, [
    runner,
    setWorkspaceError,
    setWorkspaceState,
    t,
    updateMovedFileTab,
    updateMovedFolderTabs
  ]);

  return { handleMoveActiveFile, handleMoveFile, handleMoveFolder, handleMoveTreeItems, handleRenameActiveFile, handleRenameTreeItem };
}

export function fileRelocationRecoveryMessage(
  status: "recovery-required" | "rolled-back",
  recovery: MarkdownFileRelocationRecovery,
  t: Translator
): string {
  if (status === "rolled-back") {
    return t("files.relocationRolledBack", {
      newPath: recovery.newPath,
      oldPath: recovery.oldPath
    });
  }

  const unresolvedPaths = [
    ...recovery.linkUpdates.conflictedPaths,
    ...recovery.linkUpdates.rollbackFailedPaths
  ].filter((value, index, values) => values.indexOf(value) === index);
  const visiblePaths = unresolvedPaths.slice(0, 5);
  const remainingCount = Math.max(0, unresolvedPaths.length - visiblePaths.length);
  return t("files.relocationRecoveryRequired", {
    currentPath: recovery.currentPath ?? t("files.relocationCurrentPathUnknown"),
    newPath: recovery.newPath,
    oldPath: recovery.oldPath,
    paths: visiblePaths.length > 0 ? visiblePaths.join(", ") : t("files.relocationNoLinkPaths"),
    remaining: remainingCount
  });
}

function pathName(filePath: string): string {
  const baseName = filePath.split("/").at(-1) ?? filePath;
  return baseName.replace(/\.md$/i, "");
}

function isCompletedRelocation(
  value: RelocateMarkdownFileResult
): value is Extract<RelocateMarkdownFileResult, { status: "completed" }> {
  return "file" in value && (!("status" in value) || value.status === "completed");
}
