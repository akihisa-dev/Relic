import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import type { FileTreeActions } from "../fileTreeTypes";
import {
  clearOutboundFileTreeDrag,
  FILE_TREE_OUTBOUND_FILE_DRAG_EVENT,
  getOutboundFileTreeDragItems,
  movableItemsForDestination,
  moveItemsToDestination
} from "../fileTreeModel";
import { relicClient } from "../relicClient";

const outboundFileDragIgnoreMs = 2000;

interface UseRootFileTreeDropInput {
  actions: FileTreeActions;
  isRoot: boolean;
}

export function useRootFileTreeDrop({ actions, isRoot }: UseRootFileTreeDropInput): {
  handleRootDragLeave: () => void;
  handleRootDragOver: (event: DragEvent<HTMLUListElement>) => void;
  handleRootDrop: (event: DragEvent<HTMLUListElement>) => void;
  isRootFileDragOver: boolean;
} {
  const [isRootFileDragOver, setIsRootFileDragOver] = useState(false);
  const ignoreRootFileDragOverUntilRef = useRef(0);
  const hasFileTransfer = (event: DragEvent<HTMLElement>): boolean => (
    Array.from(event.dataTransfer.types ?? []).includes("Files")
  );
  const canImportDroppedFiles = (event: DragEvent<HTMLElement>): boolean => (
    isRoot &&
    Date.now() > ignoreRootFileDragOverUntilRef.current &&
    Boolean(actions.onImportMarkdownFiles) &&
    hasFileTransfer(event)
  );
  const canMoveOutboundFilesToRoot = (event: DragEvent<HTMLElement>): boolean => (
    isRoot && hasFileTransfer(event) && movableItemsForDestination(getOutboundFileTreeDragItems(), "").length > 0
  );

  useEffect(() => {
    const clearRootDragOver = (): void => {
      ignoreRootFileDragOverUntilRef.current = 0;
      setIsRootFileDragOver(false);
    };
    const ignoreOutboundFileDrag = (): void => {
      ignoreRootFileDragOverUntilRef.current = Date.now() + outboundFileDragIgnoreMs;
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

  return {
    handleRootDragLeave: () => setIsRootFileDragOver(false),
    handleRootDragOver,
    handleRootDrop,
    isRootFileDragOver
  };
}

function droppedFilePathsFromEvent(event: DragEvent<HTMLElement>): string[] {
  if (!relicClient.current) return [];
  return Array.from(event.dataTransfer.files)
    .map((file) => relicClient.current?.getDroppedFilePath(file) ?? "")
    .filter(Boolean);
}
