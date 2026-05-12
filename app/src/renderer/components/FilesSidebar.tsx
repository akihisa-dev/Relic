import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";
import type { FileTreeExpansionRequest } from "./FileTree";
import { FileTree, FileTreeItem, findNodeByPath } from "./FileTree";

export interface FilesSidebarProps {
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  onCreateFolder: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onCreateWorkspace: () => void;
  onDeleteItem: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>) => void;
  onDuplicateFile: (path: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onMoveItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string) => void;
  onOpenFile: (path: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onOpenWorkspace: () => void;
  onRevealItem?: (path: string) => void;
  onRenameItem: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectedCountChange?: (count: number) => void;
  onTogglePin: (path: string) => void;
  openFilePaths?: Set<string>;
  workspaceState: WorkspaceState | null;
}

export function FilesSidebar({
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFileInFolder,
  onCreateFolder,
  onCreateFolderInFolder,
  onCreateWorkspace,
  onDeleteItem,
  onDeleteItems,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onOpenWorkspace,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectedCountChange,
  onTogglePin,
  openFilePaths,
  workspaceState
}: FilesSidebarProps): ReactElement {
  const [expansionRequest, setExpansionRequest] = useState<FileTreeExpansionRequest | undefined>(undefined);
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const pinnedPaths = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const userNodes = useMemo(() => workspaceState?.fileTree ?? [], [workspaceState?.fileTree]);
  const selectableItems = useMemo(() => {
    const items: Array<{ path: string; type: WorkspaceTreeNode["type"] }> = [];
    const walk = (node: WorkspaceTreeNode): void => {
      items.push({ path: node.path, type: node.type });
      if (node.type === "folder") node.children.forEach(walk);
    };

    userNodes.forEach(walk);
    return items;
  }, [userNodes]);
  const selectablePathSet = useMemo(
    () => new Set(selectableItems.map((item) => item.path)),
    [selectableItems]
  );
  const selectedItems = useMemo(
    () => selectableItems.filter((item) => selectedPaths.has(item.path)),
    [selectableItems, selectedPaths]
  );
  const t = useT();

  useEffect(() => {
    setSelectedPaths((current) => {
      const next = new Set([...current].filter((path) => selectablePathSet.has(path)));
      return next.size === current.size ? current : next;
    });
    if (selectionAnchorPath && !selectablePathSet.has(selectionAnchorPath)) {
      setSelectionAnchorPath(null);
    }
  }, [selectablePathSet, selectionAnchorPath]);

  useEffect(() => {
    onSelectedCountChange?.(selectedItems.length);
  }, [onSelectedCountChange, selectedItems.length]);

  const handleSelectItem = (
    node: WorkspaceTreeNode,
    e: React.MouseEvent<HTMLButtonElement>
  ): boolean => {
    if (!selectablePathSet.has(node.path)) return true;

    const isRangeSelect = e.shiftKey && selectionAnchorPath && selectablePathSet.has(selectionAnchorPath);
    const isToggleSelect = e.metaKey || e.ctrlKey;
    const isMultiSelectionMode = selectedPaths.size > 1;

    if (isRangeSelect) {
      const fromIndex = selectableItems.findIndex((item) => item.path === selectionAnchorPath);
      const toIndex = selectableItems.findIndex((item) => item.path === node.path);
      if (fromIndex >= 0 && toIndex >= 0) {
        const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
        setSelectedPaths(new Set(selectableItems.slice(start, end + 1).map((item) => item.path)));
      }
      return false;
    }

    if (isToggleSelect) {
      setSelectedPaths((current) => {
        const next = new Set(current);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
      setSelectionAnchorPath(node.path);
      return false;
    }

    setSelectedPaths(new Set([node.path]));
    setSelectionAnchorPath(node.path);
    return !isMultiSelectionMode;
  };

  const requestExpansion = (action: FileTreeExpansionRequest["action"], scopePath?: string): void => {
    setExpansionRequest((current) => ({ action, id: (current?.id ?? 0) + 1, scopePath }));
  };

  return (
    <div className="sidebar-section">
      {activeWorkspace ? (
        <>
          <button
            className="primary-button"
            disabled={isCreatingFile}
            onClick={onCreateFile}
            type="button"
          >
            {isCreatingFile ? t("common.running") : t("files.createNote")}
          </button>
          <button
            className="secondary-button"
            disabled={isCreatingFolder}
            onClick={onCreateFolder}
            type="button"
          >
            {isCreatingFolder ? t("common.running") : t("files.createFolder")}
          </button>
          {pinnedPaths.size > 0 ? (
            <div className="pinned-section">
              <div className="pinned-section-heading">{t("files.pinned")}</div>
              <ul className="file-tree">
                {(workspaceState?.pinnedPaths ?? []).map((p) => {
                  const node = findNodeByPath(workspaceState?.fileTree ?? [], p);

                  if (!node) return null;

                  return (
                    <FileTreeItem
                      expansionRequest={expansionRequest}
                      isPinned
                      key={p}
                      node={node}
                      onDeleteItem={onDeleteItem}
                      onDeleteSelectedItems={() => onDeleteItems(selectedItems)}
                      onCreateFileInFolder={onCreateFileInFolder}
                      onCreateFolderInFolder={onCreateFolderInFolder}
                      onDuplicateFile={onDuplicateFile}
                      onMoveFile={onMoveFile}
                      onMoveFolder={onMoveFolder}
                      onMoveItems={onMoveItems}
                      onOpenFile={onOpenFile}
                      onOpenInOtherPane={onOpenInOtherPane}
                      onRequestExpansion={requestExpansion}
                      onRevealItem={onRevealItem}
                      onRenameItem={onRenameItem}
                      onSelectFolder={onSelectFolder}
                      onSelectItem={handleSelectItem}
                      onTogglePin={onTogglePin}
                      openFilePaths={openFilePaths}
                      pinnedPaths={pinnedPaths}
                      selectedItems={selectedItems}
                      selectedPaths={selectedPaths}
                    />
                  );
                })}
              </ul>
            </div>
          ) : null}
          <FileTree
            expansionRequest={expansionRequest}
            isRoot
            nodes={userNodes}
            onDeleteItem={onDeleteItem}
            onDeleteSelectedItems={() => onDeleteItems(selectedItems)}
            onCreateFileInFolder={onCreateFileInFolder}
            onCreateFolderInFolder={onCreateFolderInFolder}
            onDuplicateFile={onDuplicateFile}
            onMoveFile={onMoveFile}
            onMoveFolder={onMoveFolder}
            onMoveItems={onMoveItems}
            onOpenFile={onOpenFile}
            onOpenInOtherPane={onOpenInOtherPane}
            onRequestExpansion={requestExpansion}
            onRevealItem={onRevealItem}
            onRenameItem={onRenameItem}
            onSelectFolder={onSelectFolder}
            onSelectItem={handleSelectItem}
            onTogglePin={onTogglePin}
            openFilePaths={openFilePaths}
            pinnedPaths={pinnedPaths}
            selectedItems={selectedItems}
            selectedPaths={selectedPaths}
          />
          <div className="workspace-actions">
            <button
              className="secondary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onOpenWorkspace}
              type="button"
            >
              {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
            </button>
            <button
              className="secondary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onCreateWorkspace}
              type="button"
            >
              {isCreatingWorkspace ? t("files.creatingWorkspace") : t("files.createNewWorkspace")}
            </button>
          </div>
        </>
      ) : (
        <div className="workspace-empty">
          <div>
            <p className="workspace-empty-title">{t("files.workspaceEmptyTitle")}</p>
            <p className="workspace-empty-copy">{t("files.workspaceHint")}</p>
          </div>
          <div className="workspace-empty-actions">
            <button
              className="primary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onOpenWorkspace}
              type="button"
            >
              {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
            </button>
            <button
              className="secondary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onCreateWorkspace}
              type="button"
            >
              {isCreatingWorkspace ? t("files.creatingWorkspace") : t("files.createNewWorkspace")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
