import { useState } from "react";
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
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
}

export function FileTreeItem({
  activePaths,
  isPinned,
  node,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onSelectFolder,
  onTogglePin,
  pinnedPaths
}: {
  activePaths: Set<string>;
  isPinned?: boolean;
  node: WorkspaceTreeNode;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
}): ReactElement {
  const t = useT();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const isFolder = node.type === "folder";

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
          onClick={() => {
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
          <span className="file-tree-name">{node.name}</span>
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
      </div>
      {node.type === "folder" && isExpanded && node.children.length > 0 ? (
        <FileTree
          activePaths={activePaths}
          nodes={node.children}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onOpenFile={onOpenFile}
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
  onMoveFile,
  onMoveFolder,
  onOpenFile,
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
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onOpenFile={onOpenFile}
          onSelectFolder={onSelectFolder}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
        />
      ))}
    </ul>
  );
}
