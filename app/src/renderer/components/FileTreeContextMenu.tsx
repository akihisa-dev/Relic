import { useState } from "react";
import type { ReactElement, RefObject } from "react";
import { createPortal } from "react-dom";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { workspaceFileKindForPath } from "../../shared/workspaceFileKinds";
import { writeEditorClipboardText } from "../editorClipboard";
import type { FileTreeActions } from "../fileTreeTypes";
import {
  canMoveAllFileTreeItems,
  fileTreeMarkdownLinkForPath,
  fileTreeOperationItems,
  moveItemsToDestination,
  normalizeDestinationFolder,
  type FileTreeMoveItem
} from "../fileTreeModel";
import { useT } from "../i18n";
import { parentFolderOf } from "../workspacePaths";
import { WorkspaceInputDialog } from "./WorkspaceInputDialog";

type FileTreeInputDialogKind = "create-file" | "create-folder" | "move";

interface FileTreeInputDialogState {
  kind: FileTreeInputDialogKind;
  value: string;
}

interface FileTreeContextMenuProps {
  actions: FileTreeActions;
  contextMenu: { x: number; y: number } | null;
  isPinned?: boolean;
  markRemoving: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  node: WorkspaceTreeNode;
  onClose: () => void;
  onOpenNode: () => void;
  onStartRename: () => void;
  selectedItems: FileTreeMoveItem[];
  useSelectedItems: boolean;
}

export function FileTreeContextMenu({
  actions,
  contextMenu,
  isPinned,
  markRemoving,
  menuRef,
  node,
  onClose,
  onOpenNode,
  onStartRename,
  selectedItems,
  useSelectedItems
}: FileTreeContextMenuProps): ReactElement | null {
  const t = useT();
  const [inputDialog, setInputDialog] = useState<FileTreeInputDialogState | null>(null);

  if (!contextMenu && !inputDialog) return null;

  const fileKind = node.type === "file" ? node.kind ?? workspaceFileKindForPath(node.path) : null;
  const isMarkdownFile = node.type === "file" && fileKind === "markdown";
  const operationItems = fileTreeOperationItems(node, selectedItems, useSelectedItems);
  const canMove = canMoveAllFileTreeItems(operationItems);

  const copyPath = (): void => {
    onClose();
    void writeEditorClipboardText(node.path).catch(() => undefined);
  };

  const copyMarkdownLink = (): void => {
    onClose();
    void writeEditorClipboardText(fileTreeMarkdownLinkForPath(node.path)).catch(() => undefined);
  };

  const openInputDialog = (kind: FileTreeInputDialogKind): void => {
    onClose();
    setInputDialog({
      kind,
      value: kind === "move"
        ? parentFolderOf(node.path)
        : kind === "create-file"
          ? t("files.defaultNewNoteName")
          : t("files.defaultNewFolderName")
    });
  };

  const submitInputDialog = (): void => {
    if (!inputDialog) return;
    const value = inputDialog.value.trim();
    if (!value && inputDialog.kind !== "move") return;

    if (inputDialog.kind === "create-file") {
      actions.onCreateFileInFolder?.(node.path, value);
    } else if (inputDialog.kind === "create-folder") {
      actions.onCreateFolderInFolder?.(node.path, value);
    } else {
      moveItemsToDestination(operationItems, normalizeDestinationFolder(value), actions);
    }
    setInputDialog(null);
  };

  const menu = contextMenu ? createPortal(
    <div
      className="tab-context-menu file-tree-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 40 }}
    >
      {useSelectedItems ? null : (
        <>
          {node.type === "folder" && actions.onCreateFileInFolder ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                openInputDialog("create-file");
              }}
              role="menuitem"
              type="button"
            >
              {t("files.createFileHere")}
            </button>
          ) : null}
          {node.type === "folder" && actions.onCreateFolderInFolder ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                openInputDialog("create-folder");
              }}
              role="menuitem"
              type="button"
            >
              {t("files.createFolderHere")}
            </button>
          ) : null}
          {node.type === "folder" && (actions.onCreateFileInFolder || actions.onCreateFolderInFolder) ? (
            <div className="tab-context-menu-separator" />
          ) : null}
          {node.type === "folder" && actions.onRequestExpansion ? (
            <>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  actions.onRequestExpansion?.("expand", node.path);
                }}
                role="menuitem"
                type="button"
              >
                {t("files.expandFolder")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  actions.onRequestExpansion?.("collapse", node.path);
                }}
                role="menuitem"
                type="button"
              >
                {t("files.collapseFolder")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  actions.onRequestExpansion?.("expand");
                }}
                role="menuitem"
                type="button"
              >
                {t("files.expandAllFolders")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  actions.onRequestExpansion?.("collapse");
                }}
                role="menuitem"
                type="button"
              >
                {t("files.collapseAllFolders")}
              </button>
              <div className="tab-context-menu-separator" />
            </>
          ) : null}
          <button className="tab-context-menu-item" onClick={onOpenNode} role="menuitem" type="button">
            {t("files.open")}
          </button>
          {node.type === "file" && actions.onOpenInOtherPane ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                actions.onOpenInOtherPane?.(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {t("pane.openInOtherPane")}
            </button>
          ) : null}
          {actions.onTogglePin ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                actions.onTogglePin?.(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {isPinned ? t("files.unpin") : t("files.pin")}
            </button>
          ) : null}
          <button className="tab-context-menu-item" onClick={copyPath} role="menuitem" type="button">
            {t("files.copyPath")}
          </button>
          {isMarkdownFile ? (
            <button className="tab-context-menu-item" onClick={copyMarkdownLink} role="menuitem" type="button">
              {t("files.copyMarkdownLink")}
            </button>
          ) : null}
          {actions.onRevealItem ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                actions.onRevealItem?.(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {t("files.revealInFinder")}
            </button>
          ) : null}
          <div className="tab-context-menu-separator" />
        </>
      )}
      {useSelectedItems || (node.type === "file" && !isMarkdownFile) ? null : (
        <button className="tab-context-menu-item" onClick={onStartRename} role="menuitem" type="button">
          {t("files.rename")}
        </button>
      )}
      {isMarkdownFile && !useSelectedItems ? (
        <button
          className="tab-context-menu-item"
          onClick={() => {
            onClose();
            actions.onDuplicateFile?.(node.path);
          }}
          role="menuitem"
          type="button"
        >
          {t("files.duplicate")}
        </button>
      ) : null}
      {canMove ? (
        <>
          <button className="tab-context-menu-item" onClick={() => openInputDialog("move")} role="menuitem" type="button">
            {useSelectedItems ? t("files.moveSelected") : t("files.move")}
          </button>
          <div className="tab-context-menu-separator" />
        </>
      ) : null}
      <button
        className="tab-context-menu-item tab-context-menu-item--icon danger"
        onClick={() => {
          onClose();
          markRemoving();
          if (useSelectedItems) actions.onDeleteSelectedItems?.();
          else actions.onDeleteItem?.(node.path, node.type);
        }}
        role="menuitem"
        type="button"
      >
        <TrashIcon />
        {useSelectedItems ? t("files.moveSelectedToTrash") : t("files.moveToTrash")}
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {menu}
      {inputDialog ? (
        <WorkspaceInputDialog
          allowEmpty={inputDialog.kind === "move"}
          cancelLabel={t("common.cancel")}
          onCancel={() => setInputDialog(null)}
          onSubmit={submitInputDialog}
          onValueChange={(value) => setInputDialog((current) => current ? { ...current, value } : null)}
          submitLabel={inputDialog.kind === "move" ? t("common.apply") : t("common.create")}
          title={inputDialog.kind === "move"
            ? t("files.moveDestinationPrompt")
            : inputDialog.kind === "create-file"
              ? t("files.newNoteName")
              : t("files.newFolderName")}
          value={inputDialog.value}
        />
      ) : null}
    </>
  );
}

function TrashIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="tab-context-menu-icon" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
