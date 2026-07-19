import { Fragment, memo, useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactElement } from "react";

import {
  childMotionPathsForAppearingFolder,
  buildVisibleFileTreeRows,
  countFilesInFolder,
  shouldUseSelectedFileTreeItems,
  type FileTreeMoveItem
} from "../fileTreeModel";
import { fileTreeActionsFromProps } from "../fileTreeActions";
import type { FileTreeItemProps, FileTreeProps } from "../fileTreeTypes";
import { useFileTreeDragDrop } from "../hooks/useFileTreeDragDrop";
import { useFileTreeItemState } from "../hooks/useFileTreeItemState";
import { useFileTreeMotion } from "../hooks/useFileTreeMotion";
import { useRootFileTreeDrop } from "../hooks/useRootFileTreeDrop";
import { useT } from "../i18n";
import { FileTreeContextMenu } from "./FileTreeContextMenu";
import { FileTreeItemRow } from "./FileTreeItemRow";

export type { FileTreeActions, FileTreeItemProps, FileTreeProps } from "../fileTreeTypes";

const defaultSelectedItems: FileTreeMoveItem[] = [];
const defaultSelectedPaths = new Set<string>();
const largeFileTreeRowThreshold = 1000;
const initialFolderFileLimit = 10;
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
  onRunFileTool,
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
  runningFileTool,
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
      onRunFileTool,
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
    onRunFileTool,
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
        fileCount={node.type === "folder"
          ? countFilesInFolder(node)
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
        runningFileTool={runningFileTool}
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
          runningFileTool={runningFileTool}
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
  onRunFileTool,
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
  runningFileTool,
  pinnedPaths,
  selectedItems = defaultSelectedItems,
  selectedPaths = defaultSelectedPaths,
  onShowAllFiles,
  showAllFiles = false,
  suppressOpeningAnimation = false
}: FileTreeProps & { animation?: "expand" }): ReactElement {
  const t = useT();
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
      onRunFileTool,
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
    onRunFileTool,
    onOpenFile,
    onOpenInOtherPane,
    onRequestExpansion,
    onRevealItem,
    onRenameItem,
    onSelectFolder,
    onSelectItem,
    onTogglePin
  ]);
  const { handleRootDragLeave, handleRootDragOver, handleRootDrop, isRootFileDragOver } =
    useRootFileTreeDrop({ actions, isRoot });

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
            runningFileTool={runningFileTool}
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
