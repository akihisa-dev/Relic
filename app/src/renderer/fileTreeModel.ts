import type { WorkspaceTreeNode } from "../shared/ipc";
import { parentFolderOf } from "./workspacePaths";

export type FileTreeExpansionAction = "expand" | "collapse";

export interface FileTreeExpansionRequest {
  action: FileTreeExpansionAction;
  id: number;
  scopePath?: string;
}

export type FileTreeMoveItem = {
  path: string;
  type: WorkspaceTreeNode["type"];
};

export interface FileTreeMoveHandlers {
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: FileTreeMoveItem[], destFolder: string) => void;
}

export function findNodeByPath(nodes: WorkspaceTreeNode[], targetPath: string): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.type === "folder") {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }

  return null;
}

export function collectNodePaths(nodes: WorkspaceTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (node: WorkspaceTreeNode): void => {
    paths.add(node.path);
    if (node.type === "folder") node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return paths;
}

export function normalizeDestinationFolder(folder: string): string {
  return folder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function movableItemsForDestination(
  items: FileTreeMoveItem[],
  destinationFolder: string
): FileTreeMoveItem[] {
  return items.filter((item) => {
    if (item.path === destinationFolder) return false;
    if (parentFolderOf(item.path) === destinationFolder) return false;
    if (item.type === "folder" && destinationFolder.startsWith(`${item.path}/`)) return false;
    return true;
  });
}

export function moveItemsToDestination(
  items: FileTreeMoveItem[],
  destinationFolder: string,
  handlers: FileTreeMoveHandlers
): void {
  const movableItems = movableItemsForDestination(items, destinationFolder);
  if (movableItems.length === 0) return;
  if (movableItems.length > 1) {
    handlers.onMoveItems?.(movableItems, destinationFolder);
    return;
  }

  const [item] = movableItems;
  if (item.type === "file") handlers.onMoveFile?.(item.path, destinationFolder);
  else handlers.onMoveFolder?.(item.path, destinationFolder);
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

export function expansionRequestAppliesTo(path: string, request?: FileTreeExpansionRequest): boolean {
  if (!request) return false;
  if (!request.scopePath) return true;
  return path === request.scopePath || path.startsWith(`${request.scopePath}/`);
}
