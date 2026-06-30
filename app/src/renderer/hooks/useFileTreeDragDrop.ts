import { useState } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import type { FileTreeActions } from "../components/FileTree";
import {
  FILE_TREE_DRAG_MIME,
  attachableFileTreePaths,
  fileTreeOperationItems,
  movableItemsForDestination,
  moveItemsToDestination,
  parseFileTreeDragPayload,
  serializeFileTreeDragPayload,
  type FileTreeMoveItem
} from "../fileTreeModel";
import { parentFolderOf } from "../workspacePaths";

interface UseFileTreeDragDropInput {
  actions: FileTreeActions;
  isRenaming: boolean;
  node: WorkspaceTreeNode;
  selectedItems: FileTreeMoveItem[];
  setIsExpanded: Dispatch<SetStateAction<boolean>>;
  useSelectedItems: boolean;
}

interface FileTreeDragDropHandlers {
  handleDragEnd: () => void;
  handleDragLeave: () => void;
  handleDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  handleDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  handleDrop: (event: DragEvent<HTMLButtonElement>) => void;
  isDragging: boolean;
  isDragOver: boolean;
}

const draggedItemsFromEvent = (event: DragEvent<HTMLButtonElement>): FileTreeMoveItem[] => (
  parseFileTreeDragPayload(event.dataTransfer.getData(FILE_TREE_DRAG_MIME))
);

const isExternalFileDrag = (event: DragEvent<HTMLButtonElement>): boolean => (
  Array.from(event.dataTransfer.types ?? []).includes("Files")
);

function droppedFilePaths(event: DragEvent<HTMLButtonElement>): string[] {
  if (!window.relic) return [];

  const filePaths: string[] = [];
  for (const file of Array.from(event.dataTransfer.files)) {
    const filePath = window.relic.getDroppedFilePath(file);
    if (filePath) filePaths.push(filePath);
  }

  return filePaths;
}

export function useFileTreeDragDrop({
  actions,
  isRenaming,
  node,
  selectedItems,
  setIsExpanded,
  useSelectedItems
}: UseFileTreeDragDropInput): FileTreeDragDropHandlers {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const dragItemsForNode = (): FileTreeMoveItem[] => (
    fileTreeOperationItems(node, selectedItems, useSelectedItems)
  );

  const dropDestinationForNode = (): string => (
    node.type === "folder" ? node.path : parentFolderOf(node.path)
  );

  const canDropOnNode = (event: DragEvent<HTMLButtonElement>): boolean => {
    if (actions.onImportMarkdownFiles && isExternalFileDrag(event)) {
      return true;
    }

    const destinationFolder = dropDestinationForNode();
    const draggedItems = draggedItemsFromEvent(event);
    if (draggedItems.length > 0) {
      return movableItemsForDestination(draggedItems, destinationFolder).length > 0;
    }

    return Array.from(event.dataTransfer.types ?? []).includes(FILE_TREE_DRAG_MIME);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>): void => {
    if (isRenaming) {
      event.preventDefault();
      return;
    }

    const items = dragItemsForNode();
    const filePaths = attachableFileTreePaths(items);
    if (filePaths.length > 0 && typeof window.relic?.startWorkspaceFileDrag === "function") {
      event.preventDefault();
      window.relic.startWorkspaceFileDrag({ paths: filePaths });
      return;
    }

    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData(FILE_TREE_DRAG_MIME, serializeFileTreeDragPayload(items));
    setIsDragging(true);
  };

  const handleDragEnd = (): void => {
    setIsDragging(false);
    setIsDragOver(false);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    if (!canDropOnNode(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isExternalFileDrag(event) ? "copy" : "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    setIsDragOver(false);
    const destinationFolder = dropDestinationForNode();

    if (actions.onImportMarkdownFiles && isExternalFileDrag(event)) {
      const sourcePaths = droppedFilePaths(event);
      if (sourcePaths.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      if (node.type === "folder") setIsExpanded(true);
      actions.onImportMarkdownFiles(sourcePaths, destinationFolder);
      return;
    }

    const items = draggedItemsFromEvent(event);
    if (movableItemsForDestination(items, destinationFolder).length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    if (node.type === "folder") setIsExpanded(true);
    moveItemsToDestination(items, destinationFolder, actions);
  };

  return {
    handleDragEnd,
    handleDragLeave,
    handleDragOver,
    handleDragStart,
    handleDrop,
    isDragging,
    isDragOver
  };
}
