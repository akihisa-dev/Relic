import type { CardbookTreeNode } from "../shared/ipc";
import { parentCardFolderOf } from "./cardbookPaths";

export type CardTreeExpansionAction = "expand" | "collapse";

export interface CardTreeExpansionRequest {
  action: CardTreeExpansionAction;
  id: number;
  scopePath?: string;
}

export type CardTreeMoveItem = {
  path: string;
  type: CardbookTreeNode["type"];
};

export const FILE_TREE_DRAG_MIME = "application/x-relic-card-tree-items";

interface CardTreeDragPayload {
  items: CardTreeMoveItem[];
}

export interface CardTreeMoveHandlers {
  onMoveCard?: (path: string, destCardFolder: string) => void;
  onMoveCardFolder?: (path: string, destCardFolder: string) => void;
  onMoveItems?: (items: CardTreeMoveItem[], destCardFolder: string) => void;
}

export interface CardTreeRenameCommit {
  nextName: string;
  shouldCommit: boolean;
}

export function findNodeByPath(nodes: CardbookTreeNode[], targetPath: string): CardbookTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.type === "cardFolder") {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }

  return null;
}

export function collectNodePaths(nodes: CardbookTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (node: CardbookTreeNode): void => {
    paths.add(node.path);
    if (node.type === "cardFolder") node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return paths;
}

export function addedNodePaths(previousPaths: Set<string>, nodes: CardbookTreeNode[]): Set<string> {
  const nextPaths = collectNodePaths(nodes);
  return new Set([...nextPaths].filter((path) => !previousPaths.has(path)));
}

export function childMotionPathsForAppearingCardFolder(node: CardbookTreeNode, isAppearing?: boolean): Set<string> | undefined {
  if (!isAppearing || node.type !== "cardFolder") return undefined;
  return new Set([node.path, ...node.children.map((child) => child.path)]);
}

export function cardTreeMarkdownLinkForPath(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

export function resolveRenameCommit(currentName: string, draft: string): CardTreeRenameCommit {
  const nextName = draft.trim();
  return {
    nextName,
    shouldCommit: nextName !== "" && nextName !== currentName
  };
}

export function shouldUseSelectedCardTreeItems(
  isSelected: boolean,
  selectedItems: CardTreeMoveItem[]
): boolean {
  return isSelected && selectedItems.length > 1;
}

export function cardTreeOperationItems(
  node: CardbookTreeNode,
  selectedItems: CardTreeMoveItem[],
  useSelectedItems: boolean
): CardTreeMoveItem[] {
  return useSelectedItems ? selectedItems : [{ path: node.path, type: node.type }];
}

export function serializeCardTreeDragPayload(items: CardTreeMoveItem[]): string {
  return JSON.stringify({ items } satisfies CardTreeDragPayload);
}

export function parseCardTreeDragPayload(value: string): CardTreeMoveItem[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (isCardTreeMoveItem(parsed)) return [parsed];
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isCardTreeMoveItem);
  } catch {
    return [];
  }
}

export function normalizeDestinationCardFolder(cardFolder: string): string {
  return cardFolder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function movableItemsForDestination(
  items: CardTreeMoveItem[],
  destinationCardFolder: string
): CardTreeMoveItem[] {
  return items.filter((item) => {
    if (item.path === destinationCardFolder) return false;
    if (parentCardFolderOf(item.path) === destinationCardFolder) return false;
    if (item.type === "cardFolder" && destinationCardFolder.startsWith(`${item.path}/`)) return false;
    return true;
  });
}

export function moveItemsToDestination(
  items: CardTreeMoveItem[],
  destinationCardFolder: string,
  handlers: CardTreeMoveHandlers
): void {
  const movableItems = movableItemsForDestination(items, destinationCardFolder);
  if (movableItems.length === 0) return;
  if (movableItems.length > 1) {
    handlers.onMoveItems?.(movableItems, destinationCardFolder);
    return;
  }

  const [item] = movableItems;
  if (item.type === "card") handlers.onMoveCard?.(item.path, destinationCardFolder);
  else handlers.onMoveCardFolder?.(item.path, destinationCardFolder);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCardTreeMoveItem(value: unknown): value is CardTreeMoveItem {
  return isRecord(value)
    && typeof value.path === "string"
    && (value.type === "card" || value.type === "cardFolder");
}

export function contextMenuPosition(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const estimatedHeight = 460;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

export function expansionRequestAppliesTo(path: string, request?: CardTreeExpansionRequest): boolean {
  if (!request) return false;
  if (!request.scopePath) return true;
  return path === request.scopePath || path.startsWith(`${request.scopePath}/`);
}
