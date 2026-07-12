import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent, MouseEvent, ReactElement } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import {
  clearOutboundFileTreeDrag,
  childMotionPathsForAppearingFolder,
  buildVisibleFileTreeRows,
  FILE_TREE_OUTBOUND_FILE_DRAG_EVENT,
  getOutboundFileTreeDragItems,
  movableItemsForDestination,
  moveItemsToDestination,
  shouldUseSelectedFileTreeItems,
  type FileTreeExpansionAction,
  type FileTreeExpansionRequest,
  type FileTreeMoveItem
} from "../fileTreeModel";
import { useFileTreeDragDrop } from "../hooks/useFileTreeDragDrop";
import { useFileTreeItemState } from "../hooks/useFileTreeItemState";
import { useFileTreeMotion } from "../hooks/useFileTreeMotion";
import { useT } from "../i18n";
import { FileTreeContextMenu } from "./FileTreeContextMenu";
import { FileTreeItemRow } from "./FileTreeItemRow";

export interface FileTreeActions {
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onDuplicateFile?: (path: string) => void;
  onImportMarkdownFiles?: (sourcePaths: string[], destFolder: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: FileTreeMoveItem[], destFolder: string) => void;
  onOpenFile: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onRequestExpansion?: (action: FileTreeExpansionAction, scopePath?: string) => void;
  onRevealItem?: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectItem?: (node: WorkspaceTreeNode, e: MouseEvent<HTMLButtonElement>) => boolean;
  onTogglePin?: (path: string) => void;
}

export interface FileTreeProps {
  actions?: FileTreeActions;
  expansionRequest?: FileTreeExpansionRequest;
  isRoot?: boolean;
  motionPaths?: Set<string>;
  nodes: WorkspaceTreeNode[];
  suppressOpeningAnimation?: boolean;
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onDuplicateFile?: (path: string) => void;
  onImportMarkdownFiles?: (sourcePaths: string[], destFolder: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: FileTreeMoveItem[], destFolder: string) => void;
  onOpenFile: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onRequestExpansion?: (action: FileTreeExpansionAction, scopePath?: string) => void;
  openingFilePath?: string | null;
  openFilePaths?: Set<string>;
  onRevealItem?: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectItem?: (node: WorkspaceTreeNode, e: MouseEvent<HTMLButtonElement>) => boolean;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
  selectedItems?: FileTreeMoveItem[];
  selectedPaths?: Set<string>;
  onShowAllFiles?: () => void;
  showAllFiles?: boolean;
}

export interface FileTreeItemProps extends Omit<FileTreeProps, "isRoot" | "motionPaths" | "nodes"> {
  isAppearing?: boolean;
  isPinned?: boolean;
  node: WorkspaceTreeNode;
  suppressOpeningAnimation?: boolean;
}

const defaultSelectedItems: FileTreeMoveItem[] = [];
const defaultSelectedPaths = new Set<string>();
const largeFileTreeRowThreshold = 1000;
const initialFolderFileLimit = 10;
const outboundFileDragIgnoreMs = 2000;

function droppedFilePathsFromEvent(event: DragEvent<HTMLElement>): string[] {
  if (!window.relic) return [];

  const filePaths: string[] = [];
  for (const file of Array.from(event.dataTransfer.files)) {
    const filePath = window.relic.getDroppedFilePath(file);
    if (filePath) filePaths.push(filePath);
  }

  return filePaths;
}

function fileTreeActionsFromProps({
  actions,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateFileInFolder,
  onCreateFolderInFolder,
  onDuplicateFile,
  onImportMarkdownFiles,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onRequestExpansion,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin
}: FileTreeProps): FileTreeActions {
  return actions ?? {
    onDeleteItem,
    onDeleteSelectedItems,
    onCreateFileInFolder,
    onCreateFolderInFolder,
    onDuplicateFile,
    onImportMarkdownFiles,
    onMoveFile,
    onMoveFolder,
    onMoveItems,
    onOpenFile,
    onOpenInOtherPane,
    onRequestExpansion,
    onRevealItem,
    onRenameItem,
    onSelectFolder,
    onSelectItem,
    onTogglePin
  };
}

export const FileTreeItem = memo(function FileTreeItem({
  actions: providedActions,
  expansionRequest,
  isAppearing,
  isPinned,
  node,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateFileInFolder,
  onCreateFolderInFolder,
  onDuplicateFile,
  onImportMarkdownFiles,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onRequestExpansion,
  openingFilePath,
  openFilePaths,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin,
  suppressOpeningAnimation = false,
  pinnedPaths,
  selectedItems = defaultSelectedItems,
  selectedPaths = defaultSelectedPaths
}: FileTreeItemProps): ReactElement {
  const [showAllChildFiles, setShowAllChildFiles] = useState(false);
  const actions = useMemo(() => (
    fileTreeActionsFromProps({
      actions: providedActions,
      expansionRequest,
      nodes: [],
      onDeleteItem,
      onDeleteSelectedItems,
      onCreateFileInFolder,
      onCreateFolderInFolder,
      onDuplicateFile,
      onImportMarkdownFiles,
      onMoveFile,
      onMoveFolder,
      onMoveItems,
      onOpenFile,
      onOpenInOtherPane,
      onRequestExpansion,
      onRevealItem,
      onRenameItem,
      onSelectFolder,
      onSelectItem,
      onTogglePin
    })
  ), [
    providedActions,
    expansionRequest,
    onDeleteItem,
    onDeleteSelectedItems,
    onCreateFileInFolder,
    onCreateFolderInFolder,
    onDuplicateFile,
    onImportMarkdownFiles,
    onMoveFile,
    onMoveFolder,
    onMoveItems,
    onOpenFile,
    onOpenInOtherPane,
    onRequestExpansion,
    onRevealItem,
    onRenameItem,
    onSelectFolder,
    onSelectItem,
    onTogglePin
  ]);
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
  } = useFileTreeItemState({ expansionRequest, node, onRenameItem: actions.onRenameItem });
  const isSelected = selectedPaths.has(node.path);
  const isOpening = !suppressOpeningAnimation && node.type === "file" && openingFilePath === node.path;
  const useSelectedItems = shouldUseSelectedFileTreeItems(isSelected, selectedItems);
  const {
    handleDragEnd,
    handleDragLeave,
    handleDragOver,
    handleDragStart,
    handleDrop,
    isDragging,
    isDragOver
  } = useFileTreeDragDrop({
    actions,
    isRenaming,
    node,
    selectedItems,
    setIsExpanded,
    useSelectedItems
  });

  const openNode = (): void => {
    closeContextMenu();
    if (node.type === "file") {
      actions.onOpenFile(node.path);
      return;
    }

    setIsExpanded(true);
    actions.onSelectFolder(node);
  };

  const activateNode = (event: MouseEvent<HTMLButtonElement>): void => {
    if (isRenaming) return;
    const shouldActivate = actions.onSelectItem?.(node, event) ?? true;
    if (!shouldActivate) return;
    if (node.type === "file") {
      actions.onOpenFile(node.path, event);
      return;
    }

    setIsExpanded((current) => !current);
    actions.onSelectFolder(node);
  };

  useEffect(() => {
    if (!isExpanded) setShowAllChildFiles(false);
  }, [isExpanded]);

  const openContextMenuForNode = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!isSelected) actions.onSelectItem?.(node, event);
    openContextMenu(event.clientX, event.clientY);
  };

  return (
    <li className="file-tree-item">
      <FileTreeItemRow
        cancelRename={cancelRename}
        commitRename={commitRename}
        inputRef={inputRef}
        isAppearing={isAppearing}
        isDragging={isDragging}
        isDragOver={isDragOver}
        isExpanded={isExpanded}
        isOpening={isOpening}
        isPinned={isPinned}
        isRemoving={isRemoving}
        isRenaming={isRenaming}
        isSelected={isSelected}
        directFileCount={node.type === "folder"
          ? node.children.filter((child) => child.type === "file").length
          : undefined}
        node={node}
        onActivate={activateNode}
        onContextMenu={openContextMenuForNode}
        onDragEnd={handleDragEnd}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        onStartRename={startRename}
        onTogglePin={actions.onTogglePin}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        useSelectedItems={useSelectedItems}
      />
      <FileTreeContextMenu
        actions={actions}
        contextMenu={contextMenu}
        isPinned={isPinned}
        markRemoving={markRemoving}
        menuRef={menuRef}
        node={node}
        onClose={closeContextMenu}
        onOpenNode={openNode}
        onStartRename={startRename}
        selectedItems={selectedItems}
        useSelectedItems={useSelectedItems}
      />
      {node.type === "folder" && isExpanded ? (
        <FileTree
          animation="expand"
          expansionRequest={expansionRequest}
          motionPaths={childMotionPathsForAppearingFolder(node, isAppearing)}
          nodes={node.children}
          actions={actions}
          onOpenFile={actions.onOpenFile}
          onSelectFolder={actions.onSelectFolder}
          openingFilePath={suppressOpeningAnimation ? null : openingFilePath}
          suppressOpeningAnimation={suppressOpeningAnimation}
          openFilePaths={openFilePaths}
          pinnedPaths={pinnedPaths}
          selectedItems={selectedItems}
          selectedPaths={selectedPaths}
          showAllFiles={showAllChildFiles}
          onShowAllFiles={() => setShowAllChildFiles(true)}
        />
      ) : null}
    </li>
  );
});

export const FileTree = memo(function FileTree({
  actions: providedActions,
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
  onImportMarkdownFiles,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onRequestExpansion,
  openingFilePath,
  openFilePaths,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = defaultSelectedItems,
  selectedPaths = defaultSelectedPaths,
  onShowAllFiles,
  showAllFiles = false,
  suppressOpeningAnimation = false
}: FileTreeProps & { animation?: "expand" }): ReactElement {
  const t = useT();
  const [isRootFileDragOver, setIsRootFileDragOver] = useState(false);
  const ignoreRootFileDragOverUntilRef = useRef(0);
  const activeAppearingPaths = useFileTreeMotion(nodes, motionPaths);
  const directFiles = useMemo(() => nodes.filter((node) => node.type === "file"), [nodes]);
  const hiddenFiles = directFiles.slice(initialFolderFileLimit);
  const shouldRevealPriorityFile = hiddenFiles.some((node) => (
    selectedPaths.has(node.path)
    || openFilePaths?.has(node.path)
    || openingFilePath === node.path
    || activeAppearingPaths.has(node.path)
  ));
  const effectiveShowAllFiles = showAllFiles || shouldRevealPriorityFile;
  useEffect(() => {
    if (!showAllFiles && shouldRevealPriorityFile) onShowAllFiles?.();
  }, [onShowAllFiles, shouldRevealPriorityFile, showAllFiles]);
  const visibleFilePaths = useMemo(() => (
    effectiveShowAllFiles || !onShowAllFiles
      ? null
      : new Set(directFiles.slice(0, initialFolderFileLimit).map((node) => node.path))
  ), [directFiles, effectiveShowAllFiles, onShowAllFiles]);
  const displayedNodes = visibleFilePaths
    ? nodes.filter((node) => node.type === "folder" || visibleFilePaths.has(node.path))
    : nodes;
  const remainingFileCount = visibleFilePaths ? hiddenFiles.length : 0;
  const lastInitiallyVisibleFilePath = directFiles[Math.min(directFiles.length, initialFolderFileLimit) - 1]?.path;
  const visibleRows = useMemo(
    () => buildVisibleFileTreeRows(nodes, { pinnedPaths }),
    [nodes, pinnedPaths]
  );
  const isLargeTree = isRoot && visibleRows.length >= largeFileTreeRowThreshold;
  const effectiveSuppressOpeningAnimation = suppressOpeningAnimation || isLargeTree;
  const effectiveOpeningFilePath = effectiveSuppressOpeningAnimation ? null : openingFilePath;
  const actions = useMemo(() => (
    fileTreeActionsFromProps({
      actions: providedActions,
      expansionRequest,
      nodes,
      onDeleteItem,
      onDeleteSelectedItems,
      onCreateFileInFolder,
      onCreateFolderInFolder,
      onDuplicateFile,
      onImportMarkdownFiles,
      onMoveFile,
      onMoveFolder,
      onMoveItems,
      onOpenFile,
      onOpenInOtherPane,
      onRequestExpansion,
      onRevealItem,
      onRenameItem,
      onSelectFolder,
      onSelectItem,
      onTogglePin
    })
  ), [
    providedActions,
    expansionRequest,
    onDeleteItem,
    onDeleteSelectedItems,
    onCreateFileInFolder,
    onCreateFolderInFolder,
    onDuplicateFile,
    onImportMarkdownFiles,
    onMoveFile,
    onMoveFolder,
    onMoveItems,
    onOpenFile,
    onOpenInOtherPane,
    onRequestExpansion,
    onRevealItem,
    onRenameItem,
    onSelectFolder,
    onSelectItem,
    onTogglePin
  ]);

  const canImportDroppedFiles = (event: DragEvent<HTMLElement>): boolean => (
    isRoot &&
    Date.now() > ignoreRootFileDragOverUntilRef.current &&
    Boolean(actions.onImportMarkdownFiles) &&
    Array.from(event.dataTransfer.types ?? []).includes("Files")
  );

  const canMoveOutboundFilesToRoot = (event: DragEvent<HTMLElement>): boolean => (
    isRoot
    && Array.from(event.dataTransfer.types ?? []).includes("Files")
    && movableItemsForDestination(getOutboundFileTreeDragItems(), "").length > 0
  );

  useEffect(() => {
    const ignoreOutboundFileDrag = (): void => {
      ignoreRootFileDragOverUntilRef.current = Date.now() + outboundFileDragIgnoreMs;
      setIsRootFileDragOver(false);
    };
    const clearRootDragOver = (): void => {
      ignoreRootFileDragOverUntilRef.current = 0;
      setIsRootFileDragOver(false);
    };
    const clearOutboundDrag = (): void => {
      clearOutboundFileTreeDrag();
      clearRootDragOver();
    };

    window.addEventListener(FILE_TREE_OUTBOUND_FILE_DRAG_EVENT, ignoreOutboundFileDrag);
    window.addEventListener("blur", clearRootDragOver);
    window.addEventListener("dragend", clearOutboundDrag);
    window.addEventListener("drop", clearRootDragOver);
    return () => {
      window.removeEventListener(FILE_TREE_OUTBOUND_FILE_DRAG_EVENT, ignoreOutboundFileDrag);
      window.removeEventListener("blur", clearRootDragOver);
      window.removeEventListener("dragend", clearOutboundDrag);
      window.removeEventListener("drop", clearRootDragOver);
    };
  }, []);

  const handleRootDragLeave = (): void => {
    setIsRootFileDragOver(false);
  };

  const handleRootDragOver = (event: DragEvent<HTMLUListElement>): void => {
    if (canMoveOutboundFilesToRoot(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setIsRootFileDragOver(true);
      return;
    }

    if (!canImportDroppedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsRootFileDragOver(true);
  };

  const handleRootDrop = (event: DragEvent<HTMLUListElement>): void => {
    setIsRootFileDragOver(false);

    const outboundItems = getOutboundFileTreeDragItems();
    if (canMoveOutboundFilesToRoot(event)) {
      event.preventDefault();
      event.stopPropagation();
      clearOutboundFileTreeDrag();
      moveItemsToDestination(outboundItems, "", actions);
      return;
    }

    if (!canImportDroppedFiles(event)) return;

    const sourcePaths = droppedFilePathsFromEvent(event);
    if (sourcePaths.length === 0) return;

    event.preventDefault();
    actions.onImportMarkdownFiles?.(sourcePaths, "");
  };

  return (
    <ul
      className={`file-tree${animation === "expand" ? " file-tree--expanding" : ""}${isRootFileDragOver ? " file-tree--external-drag-over" : ""}${isLargeTree ? " file-tree--large" : ""}`}
      data-visible-row-count={isRoot ? visibleRows.length : undefined}
      onDragLeave={handleRootDragLeave}
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
    >
      {nodes.length === 0 ? (
        <li><div className="empty-note">{t("files.noFiles")}</div></li>
      ) : null}
      {displayedNodes.map((node) => (
        <Fragment key={node.path}>
          <FileTreeItem
            isAppearing={activeAppearingPaths.has(node.path)}
            expansionRequest={expansionRequest}
            isPinned={pinnedPaths?.has(node.path)}
            node={node}
            actions={actions}
            onOpenFile={actions.onOpenFile}
            onSelectFolder={actions.onSelectFolder}
            openingFilePath={effectiveOpeningFilePath}
            suppressOpeningAnimation={effectiveSuppressOpeningAnimation}
            openFilePaths={openFilePaths}
            pinnedPaths={pinnedPaths}
            selectedItems={selectedItems}
            selectedPaths={selectedPaths}
          />
          {remainingFileCount > 0 && node.path === lastInitiallyVisibleFilePath ? (
            <li className="file-tree-more-item">
              <button className="file-tree-more-button" onClick={onShowAllFiles} type="button">
                {t("files.showRemaining", { count: remainingFileCount })}
              </button>
            </li>
          ) : null}
        </Fragment>
      ))}
    </ul>
  );
});
