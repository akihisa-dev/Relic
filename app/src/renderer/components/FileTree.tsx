import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

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

export interface FileTreeProps {
  activePaths: Set<string>;
  isRoot?: boolean;
  nodes: WorkspaceTreeNode[];
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDuplicateFile?: (path: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
}

export function FileTreeItem({
  activePaths,
  isPinned,
  node,
  onDeleteItem,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onRenameItem,
  onSelectFolder,
  onTogglePin,
  pinnedPaths
}: {
  activePaths: Set<string>;
  isPinned?: boolean;
  node: WorkspaceTreeNode;
  onDeleteItem?: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDuplicateFile?: (path: string) => void;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onRenameItem?: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
}): ReactElement {
  const t = useT();
  const isCommittingRenameRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(node.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isFolder = node.type === "folder";

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

  const handleDrop = (e: React.DragEvent, destFolder: string): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const raw = e.dataTransfer.getData("application/relic-item");
    if (!raw) return;

    const { path: srcPath, type } = JSON.parse(raw) as { path: string; type: string };
    if (srcPath === destFolder) return;
    if (type === "folder" && (destFolder === srcPath || destFolder.startsWith(srcPath + "/"))) return;

    if (type === "file") onMoveFile?.(srcPath, destFolder);
    else onMoveFolder?.(srcPath, destFolder);
  };

  return (
    <li className="file-tree-item">
      <div className="file-tree-row-wrap">
        <button
          className={`file-tree-row ${node.type}${activePaths.has(node.path) ? " active" : ""}${isDragOver ? " drag-over" : ""}`}
          draggable
          onDragEnd={() => setIsDragOver(false)}
          onDragLeave={isFolder ? (e) => { e.stopPropagation(); setIsDragOver(false); } : undefined}
          onDragOver={isFolder ? (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); } : undefined}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/relic-item", JSON.stringify({ path: node.path, type: node.type }));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrop={isFolder ? (e) => handleDrop(e, node.path) : undefined}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startRename();
          }}
          onClick={() => {
            if (isRenaming) return;
            if (node.type === "file") {
              onOpenFile(node.path);
            } else {
              setIsExpanded((v) => !v);
              onSelectFolder(node);
            }
          }}
          type="button"
        >
          <span className="file-tree-icon">{node.type === "folder" ? (isExpanded ? "▼" : "▶") : "·"}</span>
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
        {contextMenu ? (
          <div
            className="tab-context-menu file-tree-context-menu"
            ref={menuRef}
            role="menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button className="tab-context-menu-item" onClick={startRename} role="menuitem" type="button">
              {t("files.rename")}
            </button>
            {node.type === "file" ? (
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
                onDeleteItem?.(node.path, node.type);
              }}
              role="menuitem"
              type="button"
            >
              {t("files.moveToTrash")}
            </button>
          </div>
        ) : null}
      </div>
      {node.type === "folder" && isExpanded && node.children.length > 0 ? (
        <FileTree
          activePaths={activePaths}
          nodes={node.children}
          onDeleteItem={onDeleteItem}
          onDuplicateFile={onDuplicateFile}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onOpenFile={onOpenFile}
          onRenameItem={onRenameItem}
          onSelectFolder={onSelectFolder}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
        />
      ) : null}
    </li>
  );
}

export function FileTree({
  activePaths,
  isRoot = false,
  nodes,
  onDeleteItem,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onRenameItem,
  onSelectFolder,
  onTogglePin,
  pinnedPaths
}: FileTreeProps): ReactElement {
  const t = useT();
  const [isRootDragOver, setIsRootDragOver] = useState(false);

  if (nodes.length === 0 && !isRoot) {
    return <div className="empty-note">{t("files.noMarkdownFiles")}</div>;
  }

  const handleRootDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsRootDragOver(false);

    const raw = e.dataTransfer.getData("application/relic-item");
    if (!raw) return;

    const { path: srcPath, type } = JSON.parse(raw) as { path: string; type: string };
    if (!srcPath.includes("/")) return;

    if (type === "file") onMoveFile?.(srcPath, "");
    else onMoveFolder?.(srcPath, "");
  };

  return (
    <ul
      className={`file-tree${isRoot && isRootDragOver ? " file-tree--drag-over" : ""}`}
      onDragLeave={isRoot ? (e) => { if (e.currentTarget === e.target) setIsRootDragOver(false); } : undefined}
      onDragOver={isRoot ? (e) => { e.preventDefault(); setIsRootDragOver(true); } : undefined}
      onDrop={isRoot ? handleRootDrop : undefined}
    >
      {nodes.length === 0 ? (
        <li><div className="empty-note">{t("files.noMarkdownFiles")}</div></li>
      ) : null}
      {nodes.map((node) => (
        <FileTreeItem
          activePaths={activePaths}
          isPinned={pinnedPaths?.has(node.path)}
          key={node.path}
          node={node}
          onDeleteItem={onDeleteItem}
          onDuplicateFile={onDuplicateFile}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onOpenFile={onOpenFile}
          onRenameItem={onRenameItem}
          onSelectFolder={onSelectFolder}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
        />
      ))}
    </ul>
  );
}
