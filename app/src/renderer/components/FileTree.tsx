import type { MouseEvent, ReactElement } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import {
  childMotionPathsForAppearingFolder,
  shouldUseSelectedFileTreeItems,
  type FileTreeExpansionAction,
  type FileTreeExpansionRequest,
  type FileTreeMoveItem
} from "../fileTreeModel";
import { useFileTreeItemState } from "../hooks/useFileTreeItemState";
import { useFileTreeMotion } from "../hooks/useFileTreeMotion";
import { useT } from "../i18n";
import { FileTreeContextMenu } from "./FileTreeContextMenu";
import { FileTreeItemRow } from "./FileTreeItemRow";

export type { FileTreeExpansionRequest } from "../fileTreeModel";
export { findNodeByPath } from "../fileTreeModel";

export interface FileTreeProps {
  expansionRequest?: FileTreeExpansionRequest;
  isRoot?: boolean;
  motionPaths?: Set<string>;
  nodes: WorkspaceTreeNode[];
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onDuplicateFile?: (path: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: FileTreeMoveItem[], destFolder: string) => void;
  onOpenFile: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onRequestExpansion?: (action: FileTreeExpansionAction, scopePath?: string) => void;
  openFilePaths?: Set<string>;
  onRevealItem?: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectItem?: (node: WorkspaceTreeNode, e: MouseEvent<HTMLButtonElement>) => boolean;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
  selectedItems?: FileTreeMoveItem[];
  selectedPaths?: Set<string>;
}

export interface FileTreeItemProps extends Omit<FileTreeProps, "isRoot" | "motionPaths" | "nodes"> {
  isAppearing?: boolean;
  isPinned?: boolean;
  node: WorkspaceTreeNode;
}

export function FileTreeItem({
  expansionRequest,
  isAppearing,
  isPinned,
  node,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateFileInFolder,
  onCreateFolderInFolder,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onRequestExpansion,
  openFilePaths,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = [],
  selectedPaths = new Set<string>()
}: FileTreeItemProps): ReactElement {
  const {
    cancelRename,
    closeContextMenu,
    commitRename,
    contextMenu,
    inputRef,
    isExpanded,
    isRemoving,
    isRenaming,
    markRemoving,
    menuRef,
    openContextMenu,
    renameDraft,
    setIsExpanded,
    setRenameDraft,
    startRename
  } = useFileTreeItemState({ expansionRequest, node, onRenameItem });
  const isSelected = selectedPaths.has(node.path);
  const isOpen = node.type === "file" && openFilePaths?.has(node.path);
  const useSelectedItems = shouldUseSelectedFileTreeItems(isSelected, selectedItems);

  const openNode = (): void => {
    closeContextMenu();
    if (node.type === "file") {
      onOpenFile(node.path);
      return;
    }

    setIsExpanded(true);
    onSelectFolder(node);
  };

  const activateNode = (event: MouseEvent<HTMLButtonElement>): void => {
    if (isRenaming) return;
    const shouldActivate = onSelectItem?.(node, event) ?? true;
    if (!shouldActivate) return;
    if (node.type === "file") {
      onOpenFile(node.path, event);
      return;
    }

    setIsExpanded((current) => !current);
    onSelectFolder(node);
  };

  const openContextMenuForNode = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!isSelected) onSelectItem?.(node, event);
    openContextMenu(event.clientX, event.clientY);
  };

  return (
    <li className="file-tree-item">
      <FileTreeItemRow
        cancelRename={cancelRename}
        commitRename={commitRename}
        inputRef={inputRef}
        isAppearing={isAppearing}
        isExpanded={isExpanded}
        isOpen={isOpen}
        isPinned={isPinned}
        isRemoving={isRemoving}
        isRenaming={isRenaming}
        isSelected={isSelected}
        node={node}
        onActivate={activateNode}
        onContextMenu={openContextMenuForNode}
        onStartRename={startRename}
        onTogglePin={onTogglePin}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        useSelectedItems={useSelectedItems}
      />
      <FileTreeContextMenu
        contextMenu={contextMenu}
        isPinned={isPinned}
        markRemoving={markRemoving}
        menuRef={menuRef}
        node={node}
        onClose={closeContextMenu}
        onCreateFileInFolder={onCreateFileInFolder}
        onCreateFolderInFolder={onCreateFolderInFolder}
        onDeleteItem={onDeleteItem}
        onDeleteSelectedItems={onDeleteSelectedItems}
        onDuplicateFile={onDuplicateFile}
        onMoveFile={onMoveFile}
        onMoveFolder={onMoveFolder}
        onMoveItems={onMoveItems}
        onOpenInOtherPane={onOpenInOtherPane}
        onOpenNode={openNode}
        onRequestExpansion={onRequestExpansion}
        onRevealItem={onRevealItem}
        onStartRename={startRename}
        onTogglePin={onTogglePin}
        selectedItems={selectedItems}
        useSelectedItems={useSelectedItems}
      />
      {node.type === "folder" && isExpanded ? (
        <FileTree
          animation="expand"
          expansionRequest={expansionRequest}
          motionPaths={childMotionPathsForAppearingFolder(node, isAppearing)}
          nodes={node.children}
          onDeleteItem={onDeleteItem}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onCreateFileInFolder={onCreateFileInFolder}
          onCreateFolderInFolder={onCreateFolderInFolder}
          onDuplicateFile={onDuplicateFile}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onMoveItems={onMoveItems}
          onOpenFile={onOpenFile}
          onOpenInOtherPane={onOpenInOtherPane}
          onRequestExpansion={onRequestExpansion}
          openFilePaths={openFilePaths}
          onRevealItem={onRevealItem}
          onRenameItem={onRenameItem}
          onSelectFolder={onSelectFolder}
          onSelectItem={onSelectItem}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
          selectedItems={selectedItems}
          selectedPaths={selectedPaths}
        />
      ) : null}
    </li>
  );
}

export function FileTree({
  animation,
  expansionRequest,
  isRoot = false,
  motionPaths,
  nodes,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateFileInFolder,
  onCreateFolderInFolder,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onRequestExpansion,
  openFilePaths,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = [],
  selectedPaths = new Set<string>()
}: FileTreeProps & { animation?: "expand" }): ReactElement {
  const t = useT();
  const activeAppearingPaths = useFileTreeMotion(nodes, motionPaths);

  void isRoot;

  return (
    <ul
      className={`file-tree${animation === "expand" ? " file-tree--expanding" : ""}`}
    >
      {nodes.length === 0 ? (
        <li><div className="empty-note">{t("files.noMarkdownFiles")}</div></li>
      ) : null}
      {nodes.map((node) => (
        <FileTreeItem
          isAppearing={activeAppearingPaths.has(node.path)}
          expansionRequest={expansionRequest}
          isPinned={pinnedPaths?.has(node.path)}
          key={node.path}
          node={node}
          onDeleteItem={onDeleteItem}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onCreateFileInFolder={onCreateFileInFolder}
          onCreateFolderInFolder={onCreateFolderInFolder}
          onDuplicateFile={onDuplicateFile}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onMoveItems={onMoveItems}
          onOpenFile={onOpenFile}
          onOpenInOtherPane={onOpenInOtherPane}
          onRequestExpansion={onRequestExpansion}
          openFilePaths={openFilePaths}
          onRevealItem={onRevealItem}
          onRenameItem={onRenameItem}
          onSelectFolder={onSelectFolder}
          onSelectItem={onSelectItem}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
          selectedItems={selectedItems}
          selectedPaths={selectedPaths}
        />
      ))}
    </ul>
  );
}
