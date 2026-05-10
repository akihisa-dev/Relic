import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";

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

function collectNodePaths(nodes: WorkspaceTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (node: WorkspaceTreeNode): void => {
    paths.add(node.path);
    if (node.type === "folder") node.children.forEach(walk);
  };

  nodes.forEach(walk);
  return paths;
}

function parentFolderOf(path: string): string {
  const separatorIndex = path.lastIndexOf("/");
  return separatorIndex >= 0 ? path.slice(0, separatorIndex) : "";
}

function parseDragItems(dataTransfer: DataTransfer): Array<{ path: string; type: WorkspaceTreeNode["type"] }> {
  const raw = dataTransfer.getData("application/relic-item");
  if (!raw) return [];

  try {
    const payload = JSON.parse(raw) as {
      items?: Array<{ path: string; type: WorkspaceTreeNode["type"] }>;
      path?: string;
      type?: WorkspaceTreeNode["type"];
    };

    return payload.items ?? (payload.path && payload.type ? [{ path: payload.path, type: payload.type }] : []);
  } catch {
    return [];
  }
}

function movableItemsForDestination(
  items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>,
  destinationFolder: string
): Array<{ path: string; type: WorkspaceTreeNode["type"] }> {
  return items.filter((item) => {
    if (item.path === destinationFolder) return false;
    if (parentFolderOf(item.path) === destinationFolder) return false;
    if (item.type === "folder" && destinationFolder.startsWith(`${item.path}/`)) return false;
    return true;
  });
}

function shouldTreeHandleDrop(e: React.DragEvent): boolean {
  const target = e.target;
  if (!(target instanceof Element)) return false;
  const row = target.closest(".file-tree-row");
  if (!row || !e.currentTarget.contains(row)) return true;
  return row.getAttribute("data-node-type") === "file";
}

function moveItemsToDestination(
  items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>,
  destinationFolder: string,
  handlers: Pick<FileTreeProps, "onMoveFile" | "onMoveFolder" | "onMoveItems">
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

function contextMenuPosition(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const estimatedHeight = 132;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

export interface FileTreeProps {
  destinationFolder?: string;
  isRoot?: boolean;
  motionPaths?: Set<string>;
  nodes: WorkspaceTreeNode[];
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onDuplicateFile?: (path: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectItem?: (node: WorkspaceTreeNode, e: React.MouseEvent<HTMLButtonElement>) => boolean;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
  selectedItems?: Array<{ path: string; type: WorkspaceTreeNode["type"] }>;
  selectedPaths?: Set<string>;
}

export function FileTreeItem({
  isAppearing,
  isPinned,
  node,
  onDeleteItem,
  onDeleteSelectedItems,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = [],
  selectedPaths = new Set<string>()
}: {
  isAppearing?: boolean;
  isPinned?: boolean;
  node: WorkspaceTreeNode;
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteSelectedItems?: () => void;
  onDuplicateFile?: (path: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onMoveItems?: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectItem?: (node: WorkspaceTreeNode, e: React.MouseEvent<HTMLButtonElement>) => boolean;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
  selectedItems?: Array<{ path: string; type: WorkspaceTreeNode["type"] }>;
  selectedPaths?: Set<string>;
}): ReactElement {
  const t = useT();
  const isCommittingRenameRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const removeMotionTimerRef = useRef<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(node.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const isFolder = node.type === "folder";
  const isSelected = selectedPaths.has(node.path);
  const useSelectedItems = isSelected && selectedItems.length > 1;

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

  const startRename = (): void => {
    isCommittingRenameRef.current = false;
    setContextMenu(null);
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
    const nextName = renameDraft.trim();
    setIsRenaming(false);
    if (!nextName || nextName === node.name) {
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

  const handleDrop = (e: React.DragEvent, destFolder: string): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    moveItemsToDestination(parseDragItems(e.dataTransfer), destFolder, { onMoveFile, onMoveFolder, onMoveItems });
  };

  return (
    <li className="file-tree-item">
      <div className="file-tree-row-wrap">
        <button
          className={`file-tree-row ${node.type}${isSelected ? " selected" : ""}${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}${isAppearing ? " file-tree-row--appearing" : ""}${isRemoving ? " file-tree-row--removing" : ""}`}
          data-node-path={node.path}
          data-node-type={node.type}
          draggable
          onDragEnd={() => {
            setIsDragging(false);
            setIsDragOver(false);
          }}
          onDragLeave={isFolder ? (e) => { e.stopPropagation(); setIsDragOver(false); } : undefined}
          onDragOver={isFolder ? (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); } : undefined}
          onDragStart={(e) => {
            setIsDragging(true);
            const dragItems = useSelectedItems ? selectedItems : [{ path: node.path, type: node.type }];
            e.dataTransfer.setData("application/relic-item", JSON.stringify({
              items: dragItems,
              path: node.path,
              type: node.type
            }));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrop={isFolder ? (e) => handleDrop(e, node.path) : undefined}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isSelected) onSelectItem?.(node, e);
            setContextMenu(contextMenuPosition(e.clientX, e.clientY));
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startRename();
          }}
          onClick={(e) => {
            if (isRenaming) return;
            const shouldActivate = onSelectItem?.(node, e) ?? true;
            if (!shouldActivate) return;
            if (node.type === "file") {
              onOpenFile(node.path);
            } else {
              setIsExpanded((v) => !v);
              onSelectFolder(node);
            }
          }}
          type="button"
        >
          <span className={`file-tree-icon${isFolder ? " file-tree-icon--folder" : ""}${isFolder && isExpanded ? " file-tree-icon--expanded" : ""}`}>
            {node.type === "folder" ? "▶" : "·"}
          </span>
          {isRenaming ? (
            <input
              aria-label={t("files.rename")}
              className="file-tree-rename-input"
              onBlur={commitRename}
              onChange={(e) => setRenameDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") cancelRename();
              }}
              ref={inputRef}
              value={renameDraft}
            />
          ) : (
            <span className="file-tree-name">{node.name}</span>
          )}
        </button>
        {onTogglePin ? (
          <button
            className={`file-tree-pin-btn${isPinned ? " pinned" : ""}`}
            onClick={(e) => { e.stopPropagation(); onTogglePin(node.path); }}
            title={isPinned ? t("files.unpin") : t("files.pin")}
            type="button"
          >
            📌
          </button>
        ) : null}
        {contextMenu ? createPortal(
          <div
            className="tab-context-menu file-tree-context-menu"
            ref={menuRef}
            role="menu"
            style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
          >
            {useSelectedItems ? null : (
              <button className="tab-context-menu-item" onClick={startRename} role="menuitem" type="button">
                {t("files.rename")}
              </button>
            )}
            {node.type === "file" && !useSelectedItems ? (
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  setContextMenu(null);
                  onDuplicateFile?.(node.path);
                }}
                role="menuitem"
                type="button"
              >
                {t("files.duplicate")}
              </button>
            ) : null}
            <div className="tab-context-menu-separator" />
            <button
              className="tab-context-menu-item danger"
              onClick={() => {
                setContextMenu(null);
                markRemoving();
                if (useSelectedItems) onDeleteSelectedItems?.();
                else onDeleteItem?.(node.path, node.type);
              }}
              role="menuitem"
              type="button"
            >
              {useSelectedItems ? t("files.moveSelectedToTrash") : t("files.moveToTrash")}
            </button>
          </div>,
          document.body
        ) : null}
      </div>
      {node.type === "folder" && isExpanded ? (
        <FileTree
          animation="expand"
          destinationFolder={node.path}
          motionPaths={isAppearing ? new Set([node.path, ...node.children.map((child) => child.path)]) : undefined}
          nodes={node.children}
          onDeleteItem={onDeleteItem}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onDuplicateFile={onDuplicateFile}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onMoveItems={onMoveItems}
          onOpenFile={onOpenFile}
          onRenameItem={onRenameItem}
          onSelectFolder={onSelectFolder}
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

export function FileTree({
  animation,
  destinationFolder = "",
  isRoot = false,
  motionPaths,
  nodes,
  onDeleteItem,
  onDeleteSelectedItems,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onRenameItem,
  onSelectFolder,
  onSelectItem,
  onTogglePin,
  pinnedPaths,
  selectedItems = [],
  selectedPaths = new Set<string>()
}: FileTreeProps & { animation?: "expand" }): ReactElement {
  const t = useT();
  const [isTreeDragOver, setIsTreeDragOver] = useState(false);
  const previousPathsRef = useRef<Set<string>>(collectNodePaths(nodes));
  const [appearingPaths, setAppearingPaths] = useState<Set<string>>(new Set());
  const activeAppearingPaths = motionPaths ?? appearingPaths;

  useEffect(() => {
    const nextPaths = collectNodePaths(nodes);
    const previousPaths = previousPathsRef.current;

    const addedPaths = [...nextPaths].filter((path) => !previousPaths.has(path));
    previousPathsRef.current = nextPaths;

    if (addedPaths.length === 0) return;

    setAppearingPaths(new Set(addedPaths));
    const timeout = window.setTimeout(() => setAppearingPaths(new Set()), 260);

    return () => window.clearTimeout(timeout);
  }, [nodes]);

  const handleTreeDrop = (e: React.DragEvent): void => {
    if (!shouldTreeHandleDrop(e)) return;

    e.preventDefault();
    e.stopPropagation();
    setIsTreeDragOver(false);

    moveItemsToDestination(parseDragItems(e.dataTransfer), destinationFolder, { onMoveFile, onMoveFolder, onMoveItems });
  };

  return (
    <ul
      className={`file-tree${animation === "expand" ? " file-tree--expanding" : ""}${isTreeDragOver ? " file-tree--drag-over" : ""}`}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsTreeDragOver(false); }}
      onDragOver={(e) => {
        if (!shouldTreeHandleDrop(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setIsTreeDragOver(true);
      }}
      onDrop={handleTreeDrop}
    >
      {nodes.length === 0 ? (
        <li><div className="empty-note">{t("files.noMarkdownFiles")}</div></li>
      ) : null}
      {nodes.map((node) => (
        <FileTreeItem
          isAppearing={activeAppearingPaths.has(node.path)}
          isPinned={pinnedPaths?.has(node.path)}
          key={node.path}
          node={node}
          onDeleteItem={onDeleteItem}
          onDeleteSelectedItems={onDeleteSelectedItems}
          onDuplicateFile={onDuplicateFile}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onMoveItems={onMoveItems}
          onOpenFile={onOpenFile}
          onRenameItem={onRenameItem}
          onSelectFolder={onSelectFolder}
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
