import { useEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { CardbookTreeNode } from "../../shared/ipc";
import {
  contextMenuPosition,
  expansionRequestAppliesTo,
  resolveRenameCommit,
  type CardTreeExpansionRequest
} from "../cardTreeModel";

interface UseCardTreeItemStateArgs {
  expansionRequest?: CardTreeExpansionRequest;
  node: CardbookTreeNode;
  onRenameItem?: (path: string, type: CardbookTreeNode["type"], newName: string) => void;
}

export function useCardTreeItemState({
  expansionRequest,
  node,
  onRenameItem
}: UseCardTreeItemStateArgs): {
  cancelRename: () => void;
  closeContextMenu: () => void;
  commitRename: () => void;
  contextMenu: { x: number; y: number } | null;
  inputRef: RefObject<HTMLInputElement | null>;
  isExpanded: boolean;
  isRemoving: boolean;
  isRenaming: boolean;
  markRemoving: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  openContextMenu: (x: number, y: number) => void;
  renameDraft: string;
  setIsExpanded: Dispatch<SetStateAction<boolean>>;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  startRename: () => void;
} {
  const isCommittingRenameRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const removeMotionTimerRef = useRef<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(node.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (e: PointerEvent): void => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    return () => {
      if (removeMotionTimerRef.current) window.clearTimeout(removeMotionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (node.type !== "cardFolder" || !expansionRequestAppliesTo(node.path, expansionRequest)) return;
    setIsExpanded(expansionRequest?.action === "expand");
  }, [expansionRequest, node.path, node.type]);

  const closeContextMenu = (): void => setContextMenu(null);

  const openContextMenu = (x: number, y: number): void => {
    setContextMenu(contextMenuPosition(x, y));
  };

  const startRename = (): void => {
    isCommittingRenameRef.current = false;
    closeContextMenu();
    setRenameDraft(node.name);
    setIsRenaming(true);
  };

  const cancelRename = (): void => {
    isCommittingRenameRef.current = false;
    setRenameDraft(node.name);
    setIsRenaming(false);
  };

  const commitRename = (): void => {
    if (isCommittingRenameRef.current) return;
    isCommittingRenameRef.current = true;
    const { nextName, shouldCommit } = resolveRenameCommit(node.name, renameDraft);
    setIsRenaming(false);
    if (!shouldCommit) {
      setRenameDraft(node.name);
      isCommittingRenameRef.current = false;
      return;
    }

    onRenameItem?.(node.path, node.type, nextName);
  };

  const markRemoving = (): void => {
    setIsRemoving(true);
    if (removeMotionTimerRef.current) window.clearTimeout(removeMotionTimerRef.current);
    removeMotionTimerRef.current = window.setTimeout(() => {
      setIsRemoving(false);
      removeMotionTimerRef.current = null;
    }, 190);
  };

  return {
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
  };
}
