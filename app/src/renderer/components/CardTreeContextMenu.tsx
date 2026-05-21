import type { ReactElement, RefObject } from "react";
import { createPortal } from "react-dom";

import type { CardbookTreeNode } from "../../shared/ipc";
import {
  cardTreeMarkdownLinkForPath,
  cardTreeOperationItems,
  moveItemsToDestination,
  normalizeDestinationCardFolder,
  type CardTreeExpansionAction,
  type CardTreeMoveItem
} from "../cardTreeModel";
import { useT } from "../i18n";
import { parentCardFolderOf } from "../cardbookPaths";

interface CardTreeContextMenuProps {
  contextMenu: { x: number; y: number } | null;
  isPinned?: boolean;
  markRemoving: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  node: CardbookTreeNode;
  onClose: () => void;
  onCreateCardInCardFolder?: (cardFolderPath: string) => void;
  onCreateCardFolderInCardFolder?: (cardFolderPath: string) => void;
  onDeleteItem?: (path: string, type: CardbookTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onDuplicateCard?: (path: string) => void;
  onMoveCard?: (path: string, destCardFolder: string) => void;
  onMoveCardFolder?: (path: string, destCardFolder: string) => void;
  onMoveItems?: (items: CardTreeMoveItem[], destCardFolder: string) => void;
  onOpenInOtherPane?: (path: string) => void;
  onOpenNode: () => void;
  onRequestExpansion?: (action: CardTreeExpansionAction, scopePath?: string) => void;
  onRevealItem?: (path: string) => void;
  onStartRename: () => void;
  onTogglePin?: (path: string) => void;
  selectedItems: CardTreeMoveItem[];
  useSelectedItems: boolean;
}

export function CardTreeContextMenu({
  contextMenu,
  isPinned,
  markRemoving,
  menuRef,
  node,
  onClose,
  onCreateCardInCardFolder,
  onCreateCardFolderInCardFolder,
  onDeleteItem,
  onDeleteSelectedItems,
  onDuplicateCard,
  onMoveCard,
  onMoveCardFolder,
  onMoveItems,
  onOpenInOtherPane,
  onOpenNode,
  onRequestExpansion,
  onRevealItem,
  onStartRename,
  onTogglePin,
  selectedItems,
  useSelectedItems
}: CardTreeContextMenuProps): ReactElement | null {
  const t = useT();

  if (!contextMenu) return null;

  const copyPath = (): void => {
    onClose();
    void navigator.clipboard?.writeText(node.path);
  };

  const copyMarkdownLink = (): void => {
    onClose();
    void navigator.clipboard?.writeText(cardTreeMarkdownLinkForPath(node.path));
  };

  const moveNode = (): void => {
    onClose();
    const defaultCardFolder = parentCardFolderOf(node.path);
    const destination = window.prompt(t("cards.moveDestinationPrompt"), defaultCardFolder);
    if (destination === null) return;
    moveItemsToDestination(
      cardTreeOperationItems(node, selectedItems, useSelectedItems),
      normalizeDestinationCardFolder(destination),
      { onMoveCard, onMoveCardFolder, onMoveItems }
    );
  };

  return createPortal(
    <div
      className="tab-context-menu card-tree-context-menu"
      ref={menuRef}
      role="menu"
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
    >
      {useSelectedItems ? null : (
        <>
          {node.type === "cardFolder" && onCreateCardInCardFolder ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                onCreateCardInCardFolder(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {t("cards.createCardHere")}
            </button>
          ) : null}
          {node.type === "cardFolder" && onCreateCardFolderInCardFolder ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                onCreateCardFolderInCardFolder(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {t("cards.createCardFolderHere")}
            </button>
          ) : null}
          {node.type === "cardFolder" && (onCreateCardInCardFolder || onCreateCardFolderInCardFolder) ? (
            <div className="tab-context-menu-separator" />
          ) : null}
          {node.type === "cardFolder" && onRequestExpansion ? (
            <>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  onRequestExpansion("expand", node.path);
                }}
                role="menuitem"
                type="button"
              >
                {t("cards.expandCardFolder")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  onRequestExpansion("collapse", node.path);
                }}
                role="menuitem"
                type="button"
              >
                {t("cards.collapseCardFolder")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  onRequestExpansion("expand");
                }}
                role="menuitem"
                type="button"
              >
                {t("cards.expandAllCardFolders")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onClose();
                  onRequestExpansion("collapse");
                }}
                role="menuitem"
                type="button"
              >
                {t("cards.collapseAllCardFolders")}
              </button>
              <div className="tab-context-menu-separator" />
            </>
          ) : null}
          <button className="tab-context-menu-item" onClick={onOpenNode} role="menuitem" type="button">
            {t("cards.open")}
          </button>
          {node.type === "card" && onOpenInOtherPane ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                onOpenInOtherPane(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {t("pane.openInOtherPane")}
            </button>
          ) : null}
          {onTogglePin ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                onTogglePin(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {isPinned ? t("cards.unpin") : t("cards.pin")}
            </button>
          ) : null}
          <button className="tab-context-menu-item" onClick={copyPath} role="menuitem" type="button">
            {t("cards.copyPath")}
          </button>
          {node.type === "card" ? (
            <button className="tab-context-menu-item" onClick={copyMarkdownLink} role="menuitem" type="button">
              {t("cards.copyMarkdownLink")}
            </button>
          ) : null}
          {onRevealItem ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onClose();
                onRevealItem(node.path);
              }}
              role="menuitem"
              type="button"
            >
              {t("cards.revealInFinder")}
            </button>
          ) : null}
          <div className="tab-context-menu-separator" />
        </>
      )}
      {useSelectedItems ? null : (
        <button className="tab-context-menu-item" onClick={onStartRename} role="menuitem" type="button">
          {t("cards.rename")}
        </button>
      )}
      {node.type === "card" && !useSelectedItems ? (
        <button
          className="tab-context-menu-item"
          onClick={() => {
            onClose();
            onDuplicateCard?.(node.path);
          }}
          role="menuitem"
          type="button"
        >
          {t("cards.duplicate")}
        </button>
      ) : null}
      <button className="tab-context-menu-item" onClick={moveNode} role="menuitem" type="button">
        {useSelectedItems ? t("cards.moveSelected") : t("cards.move")}
      </button>
      <div className="tab-context-menu-separator" />
      <button
        className="tab-context-menu-item tab-context-menu-item--icon danger"
        onClick={() => {
          onClose();
          markRemoving();
          if (useSelectedItems) onDeleteSelectedItems?.();
          else onDeleteItem?.(node.path, node.type);
        }}
        role="menuitem"
        type="button"
      >
        <TrashIcon />
        {useSelectedItems ? t("cards.moveSelectedToTrash") : t("cards.moveToTrash")}
      </button>
    </div>,
    document.body
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
