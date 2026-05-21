import { useState } from "react";
import type { DragEvent, MouseEvent, ReactElement } from "react";

import type { CardbookTreeNode } from "../../shared/ipc";
import {
  childMotionPathsForAppearingCardFolder,
  FILE_TREE_DRAG_MIME,
  cardTreeOperationItems,
  movableItemsForDestination,
  moveItemsToDestination,
  parseCardTreeDragPayload,
  serializeCardTreeDragPayload,
  shouldUseSelectedCardTreeItems,
  type CardTreeExpansionAction,
  type CardTreeExpansionRequest,
  type CardTreeMoveItem
} from "../cardTreeModel";
import { useCardTreeItemState } from "../hooks/useCardTreeItemState";
import { useCardTreeMotion } from "../hooks/useCardTreeMotion";
import { useT } from "../i18n";
import { parentCardFolderOf } from "../cardbookPaths";
import { CardTreeContextMenu } from "./CardTreeContextMenu";
import { CardTreeItemRow } from "./CardTreeItemRow";

export type { CardTreeExpansionRequest } from "../cardTreeModel";
export { findNodeByPath } from "../cardTreeModel";

export interface CardTreeProps {
  expansionRequest?: CardTreeExpansionRequest;
  isRoot?: boolean;
  motionPaths?: Set<string>;
  nodes: CardbookTreeNode[];
  onDeleteItem?: (path: string, type: CardbookTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onCreateCardInCardFolder?: (cardFolderPath: string) => void;
  onCreateCardFolderInCardFolder?: (cardFolderPath: string) => void;
  onDuplicateCard?: (path: string) => void;
  onMoveCard?: (path: string, destCardFolder: string) => void;
  onMoveCardFolder?: (path: string, destCardFolder: string) => void;
  onMoveItems?: (items: CardTreeMoveItem[], destCardFolder: string) => void;
  onOpenCard: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onRequestExpansion?: (action: CardTreeExpansionAction, scopePath?: string) => void;
  openCardPaths?: Set<string>;
  onRevealItem?: (path: string) => void;
  onRenameItem?: (path: string, type: CardbookTreeNode["type"], newName: string) => void;
  onSelectCardFolder: (node: Extract<CardbookTreeNode, { type: "cardFolder" }>) => void;
  onSelectItem?: (node: CardbookTreeNode, e: MouseEvent<HTMLButtonElement>) => boolean;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
  selectedItems?: CardTreeMoveItem[];
  selectedPaths?: Set<string>;
}

export interface CardTreeItemProps extends Omit<CardTreeProps, "isRoot" | "motionPaths" | "nodes"> {
  isAppearing?: boolean;
  isPinned?: boolean;
  node: CardbookTreeNode;
}

export function CardTreeItem({
  expansionRequest,
  isAppearing,
  isPinned,
  node,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateCardInCardFolder,
  onCreateCardFolderInCardFolder,
  onDuplicateCard,
  onMoveCard,
  onMoveCardFolder,
  onMoveItems,
  onOpenCard,
  onOpenInOtherPane,
  onRequestExpansion,
  openCardPaths,
  onRevealItem,
  onRenameItem,
  onSelectCardFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = [],
  selectedPaths = new Set<string>()
}: CardTreeItemProps): ReactElement {
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
  } = useCardTreeItemState({ expansionRequest, node, onRenameItem });
  const isSelected = selectedPaths.has(node.path);
  const isOpen = node.type === "card" && openCardPaths?.has(node.path);
  const useSelectedItems = shouldUseSelectedCardTreeItems(isSelected, selectedItems);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const openNode = (): void => {
    closeContextMenu();
    if (node.type === "card") {
      onOpenCard(node.path);
      return;
    }

    setIsExpanded(true);
    onSelectCardFolder(node);
  };

  const activateNode = (event: MouseEvent<HTMLButtonElement>): void => {
    if (isRenaming) return;
    const shouldActivate = onSelectItem?.(node, event) ?? true;
    if (!shouldActivate) return;
    if (node.type === "card") {
      onOpenCard(node.path, event);
      return;
    }

    setIsExpanded((current) => !current);
    onSelectCardFolder(node);
  };

  const openContextMenuForNode = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!isSelected) onSelectItem?.(node, event);
    openContextMenu(event.clientX, event.clientY);
  };

  const dragItemsForNode = (): CardTreeMoveItem[] => (
    cardTreeOperationItems(node, selectedItems, useSelectedItems)
  );

  const handleDragStart = (event: DragEvent<HTMLButtonElement>): void => {
    if (isRenaming) {
      event.preventDefault();
      return;
    }

    const items = dragItemsForNode();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(FILE_TREE_DRAG_MIME, serializeCardTreeDragPayload(items));
    setIsDragging(true);
  };

  const handleDragEnd = (): void => {
    setIsDragging(false);
    setIsDragOver(false);
  };

  const draggedItemsFromEvent = (event: DragEvent<HTMLButtonElement>): CardTreeMoveItem[] => (
    parseCardTreeDragPayload(event.dataTransfer.getData(FILE_TREE_DRAG_MIME))
  );

  const dropDestinationForNode = (): string => (
    node.type === "cardFolder" ? node.path : parentCardFolderOf(node.path)
  );

  const canDropOnNode = (event: DragEvent<HTMLButtonElement>): boolean => {
    const destinationCardFolder = dropDestinationForNode();
    const draggedItems = draggedItemsFromEvent(event);
    if (draggedItems.length > 0) {
      return movableItemsForDestination(draggedItems, destinationCardFolder).length > 0;
    }

    return Array.from(event.dataTransfer.types ?? []).includes(FILE_TREE_DRAG_MIME);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>): void => {
    if (!canDropOnNode(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>): void => {
    setIsDragOver(false);

    const items = draggedItemsFromEvent(event);
    const destinationCardFolder = dropDestinationForNode();
    if (movableItemsForDestination(items, destinationCardFolder).length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    if (node.type === "cardFolder") setIsExpanded(true);
    moveItemsToDestination(items, destinationCardFolder, { onMoveCard, onMoveCardFolder, onMoveItems });
  };

  return (
    <li className="card-tree-item">
      <CardTreeItemRow
        cancelRename={cancelRename}
        commitRename={commitRename}
        inputRef={inputRef}
        isAppearing={isAppearing}
        isDragging={isDragging}
        isDragOver={isDragOver}
        isExpanded={isExpanded}
        isOpen={isOpen}
        isPinned={isPinned}
        isRemoving={isRemoving}
        isRenaming={isRenaming}
        isSelected={isSelected}
        node={node}
        onActivate={activateNode}
        onContextMenu={openContextMenuForNode}
        onDragEnd={handleDragEnd}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        onStartRename={startRename}
        onTogglePin={onTogglePin}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        useSelectedItems={useSelectedItems}
      />
      <CardTreeContextMenu
        contextMenu={contextMenu}
        isPinned={isPinned}
        markRemoving={markRemoving}
        menuRef={menuRef}
        node={node}
        onClose={closeContextMenu}
        onCreateCardInCardFolder={onCreateCardInCardFolder}
        onCreateCardFolderInCardFolder={onCreateCardFolderInCardFolder}
        onDeleteItem={onDeleteItem}
        onDeleteSelectedItems={onDeleteSelectedItems}
        onDuplicateCard={onDuplicateCard}
        onMoveCard={onMoveCard}
        onMoveCardFolder={onMoveCardFolder}
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
      {node.type === "cardFolder" && isExpanded ? (
        <CardTree
          animation="expand"
          expansionRequest={expansionRequest}
          motionPaths={childMotionPathsForAppearingCardFolder(node, isAppearing)}
          nodes={node.children}
          onDeleteItem={onDeleteItem}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onCreateCardInCardFolder={onCreateCardInCardFolder}
          onCreateCardFolderInCardFolder={onCreateCardFolderInCardFolder}
          onDuplicateCard={onDuplicateCard}
          onMoveCard={onMoveCard}
          onMoveCardFolder={onMoveCardFolder}
          onMoveItems={onMoveItems}
          onOpenCard={onOpenCard}
          onOpenInOtherPane={onOpenInOtherPane}
          onRequestExpansion={onRequestExpansion}
          openCardPaths={openCardPaths}
          onRevealItem={onRevealItem}
          onRenameItem={onRenameItem}
          onSelectCardFolder={onSelectCardFolder}
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

export function CardTree({
  animation,
  expansionRequest,
  isRoot = false,
  motionPaths,
  nodes,
  onDeleteItem,
  onDeleteSelectedItems,
  onCreateCardInCardFolder,
  onCreateCardFolderInCardFolder,
  onDuplicateCard,
  onMoveCard,
  onMoveCardFolder,
  onMoveItems,
  onOpenCard,
  onOpenInOtherPane,
  onRequestExpansion,
  openCardPaths,
  onRevealItem,
  onRenameItem,
  onSelectCardFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = [],
  selectedPaths = new Set<string>()
}: CardTreeProps & { animation?: "expand" }): ReactElement {
  const t = useT();
  const activeAppearingPaths = useCardTreeMotion(nodes, motionPaths);

  void isRoot;

  return (
    <ul
      className={`card-tree${animation === "expand" ? " card-tree--expanding" : ""}`}
    >
      {nodes.length === 0 ? (
        <li><div className="empty-note">{t("cards.noMarkdownCards")}</div></li>
      ) : null}
      {nodes.map((node) => (
        <CardTreeItem
          isAppearing={activeAppearingPaths.has(node.path)}
          expansionRequest={expansionRequest}
          isPinned={pinnedPaths?.has(node.path)}
          key={node.path}
          node={node}
          onDeleteItem={onDeleteItem}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onCreateCardInCardFolder={onCreateCardInCardFolder}
          onCreateCardFolderInCardFolder={onCreateCardFolderInCardFolder}
          onDuplicateCard={onDuplicateCard}
          onMoveCard={onMoveCard}
          onMoveCardFolder={onMoveCardFolder}
          onMoveItems={onMoveItems}
          onOpenCard={onOpenCard}
          onOpenInOtherPane={onOpenInOtherPane}
          onRequestExpansion={onRequestExpansion}
          openCardPaths={openCardPaths}
          onRevealItem={onRevealItem}
          onRenameItem={onRenameItem}
          onSelectCardFolder={onSelectCardFolder}
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
