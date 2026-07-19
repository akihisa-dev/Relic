import { useState } from "react";

import type { FileTreeActions } from "../fileTreeTypes";
import { moveItemsToDestination, normalizeDestinationFolder, type FileTreeMoveItem } from "../fileTreeModel";
import { parentFolderOf } from "../workspacePaths";

export type FileTreeInputDialogKind = "create-file" | "create-folder" | "move";

export interface FileTreeInputDialogState {
  kind: FileTreeInputDialogKind;
  value: string;
}

interface UseFileTreeContextMenuDialogInput {
  actions: FileTreeActions;
  defaultFolderName: string;
  defaultNoteName: string;
  nodePath: string;
  onMenuClose: () => void;
  operationItems: FileTreeMoveItem[];
}

export function useFileTreeContextMenuDialog({
  actions,
  defaultFolderName,
  defaultNoteName,
  nodePath,
  onMenuClose,
  operationItems
}: UseFileTreeContextMenuDialogInput): {
  closeInputDialog: () => void;
  inputDialog: FileTreeInputDialogState | null;
  openInputDialog: (kind: FileTreeInputDialogKind) => void;
  setInputValue: (value: string) => void;
  submitInputDialog: () => void;
} {
  const [inputDialog, setInputDialog] = useState<FileTreeInputDialogState | null>(null);

  const openInputDialog = (kind: FileTreeInputDialogKind): void => {
    onMenuClose();
    setInputDialog({
      kind,
      value: kind === "move"
        ? parentFolderOf(nodePath)
        : kind === "create-file" ? defaultNoteName : defaultFolderName
    });
  };
  const submitInputDialog = (): void => {
    if (!inputDialog) return;
    const value = inputDialog.value.trim();
    if (!value && inputDialog.kind !== "move") return;

    if (inputDialog.kind === "create-file") actions.onCreateFileInFolder?.(nodePath, value);
    else if (inputDialog.kind === "create-folder") actions.onCreateFolderInFolder?.(nodePath, value);
    else moveItemsToDestination(operationItems, normalizeDestinationFolder(value), actions);
    setInputDialog(null);
  };

  return {
    closeInputDialog: () => setInputDialog(null),
    inputDialog,
    openInputDialog,
    setInputValue: (value) => setInputDialog((current) => current ? { ...current, value } : null),
    submitInputDialog
  };
}
