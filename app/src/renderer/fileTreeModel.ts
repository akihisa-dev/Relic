import type { WorkspaceTreeFileKind, WorkspaceTreeNode } from "../shared/ipc";
import { parentFolderOf } from "./workspacePaths";

export type FileTreeExpansionAction = "expand" | "collapse";

export interface FileTreeExpansionRequest {
  action: FileTreeExpansionAction;
  id: number;
  scopePath?: string;
}

export type FileTreeMoveItem = {
  kind?: WorkspaceTreeFileKind;
  path: string;
  type: WorkspaceTreeNode["type"];
};

export const FILE_TREE_DRAG_MIME = "application/x-relic-file-tree-items";
export const FILE_TREE_OUTBOUND_FILE_DRAG_EVENT = "relic:file-tree-outbound-file-drag";

interface FileTreeDragPayload {
  items: FileTreeMoveItem[];
}

export interface FileTreeMoveHandlers {
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: FileTreeMoveItem[], destFolder: string) => void;
}

export interface FileTreeRenameCommit {
  nextName: string;
  shouldCommit: boolean;
}

export interface VisibleFileTreeRow {
  depth: number;
  isExpanded: boolean;
  isPinned: boolean;
  node: WorkspaceTreeNode;
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

export function collectFolderPaths(nodes: WorkspaceTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (node: WorkspaceTreeNode): void => {
    if (node.type !== "folder") return;
    paths.add(node.path);
    node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return paths;
}

export function buildVisibleFileTreeRows(
  nodes: WorkspaceTreeNode[],
  options: {
    expandedPaths?: Set<string>;
    pinnedPaths?: Set<string>;
  } = {}
): VisibleFileTreeRow[] {
  const expandedPaths = options.expandedPaths ?? collectFolderPaths(nodes);
  const rows: VisibleFileTreeRow[] = [];

  const walk = (node: WorkspaceTreeNode, depth: number): void => {
    const isExpanded = node.type === "folder" && expandedPaths.has(node.path);
    rows.push({
      depth,
      isExpanded,
      isPinned: options.pinnedPaths?.has(node.path) ?? false,
      node
    });

    if (node.type === "folder" && isExpanded) {
      node.children.forEach((child) => walk(child, depth + 1));
    }
  };

  nodes.forEach((node) => walk(node, 0));
  return rows;
}

export function addedNodePaths(previousPaths: Set<string>, nodes: WorkspaceTreeNode[]): Set<string> {
  const nextPaths = collectNodePaths(nodes);
  return new Set([...nextPaths].filter((path) => !previousPaths.has(path)));
}

export function childMotionPathsForAppearingFolder(node: WorkspaceTreeNode, isAppearing?: boolean): Set<string> | undefined {
  if (!isAppearing || node.type !== "folder") return undefined;
  return new Set([node.path, ...node.children.map((child) => child.path)]);
}

export function fileTreeMarkdownLinkForPath(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

export function resolveRenameCommit(currentName: string, draft: string): FileTreeRenameCommit {
  const nextName = draft.trim();
  return {
    nextName,
    shouldCommit: nextName !== "" && nextName !== currentName
  };
}

export function shouldUseSelectedFileTreeItems(
  isSelected: boolean,
  selectedItems: FileTreeMoveItem[]
): boolean {
  return isSelected && selectedItems.length > 1;
}

export function fileTreeOperationItems(
  node: WorkspaceTreeNode,
  selectedItems: FileTreeMoveItem[],
  useSelectedItems: boolean
): FileTreeMoveItem[] {
  return useSelectedItems ? selectedItems : [{ kind: node.type === "file" ? node.kind : undefined, path: node.path, type: node.type }];
}

export function attachableFileTreePaths(items: FileTreeMoveItem[]): string[] {
  return items.reduce<string[]>((paths, item) => {
    if (item.type === "file") paths.push(item.path);
    return paths;
  }, []);
}

export function serializeFileTreeDragPayload(items: FileTreeMoveItem[]): string {
  return JSON.stringify({ items } satisfies FileTreeDragPayload);
}

export function parseFileTreeDragPayload(value: string): FileTreeMoveItem[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (isFileTreeMoveItem(parsed)) return [parsed];
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isFileTreeMoveItem);
  } catch {
    return [];
  }
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
    if (item.type === "file" && item.kind === "image") return false;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFileTreeMoveItem(value: unknown): value is FileTreeMoveItem {
  return isRecord(value)
    && typeof value.path === "string"
    && (value.type === "file" || value.type === "folder")
    && (value.kind === undefined || value.kind === "image" || value.kind === "markdown");
}

export function expansionRequestAppliesTo(path: string, request?: FileTreeExpansionRequest): boolean {
  if (!request) return false;
  if (!request.scopePath) return true;
  return path === request.scopePath || path.startsWith(`${request.scopePath}/`);
}
