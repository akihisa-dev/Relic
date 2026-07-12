import { memo } from "react";
import type { Dispatch, DragEvent, MouseEvent, ReactElement, RefObject, SetStateAction } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";

interface FileTreeItemRowProps {
  commitRename: () => void;
  cancelRename: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  isAppearing?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  isExpanded: boolean;
  isOpening?: boolean;
  isPinned?: boolean;
  isRemoving: boolean;
  isRenaming: boolean;
  isSelected: boolean;
  fileCount?: number;
  node: WorkspaceTreeNode;
  onActivate: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onStartRename: () => void;
  onTogglePin?: (path: string) => void;
  renameDraft: string;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  useSelectedItems: boolean;
}

export const FileTreeItemRow = memo(function FileTreeItemRow({
  cancelRename,
  commitRename,
  inputRef,
  isAppearing,
  isDragging,
  isDragOver,
  isExpanded,
  isOpening,
  isPinned,
  isRemoving,
  isRenaming,
  isSelected,
  fileCount,
  node,
  onActivate,
  onContextMenu,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDrop,
  onStartRename,
  onTogglePin,
  renameDraft,
  setRenameDraft,
  useSelectedItems
}: FileTreeItemRowProps): ReactElement {
  const t = useT();
  const isFolder = node.type === "folder";
  const isImage = node.type === "file" && node.kind === "image";
  const isPdf = node.type === "file" && node.kind === "pdf";
  const rowClassName = `file-tree-row ${node.type}${isOpening ? " file-tree-row--opening" : ""}${isSelected ? " selected" : ""}${useSelectedItems ? " multi-selected" : ""}${isDragging ? " dragging" : ""}${isDragOver ? " drag-over" : ""}${isAppearing ? " file-tree-row--appearing" : ""}${isRemoving ? " file-tree-row--removing" : ""}`;
  const icon = (
    <span className={`file-tree-icon${isFolder ? " file-tree-icon--folder" : ""}${isFolder && isExpanded ? " file-tree-icon--expanded" : ""}`}>
      {node.type === "folder" ? (
        <>
          <span aria-hidden="true" className="file-tree-folder-chevron">▶</span>
          <FolderStateIcon isExpanded={isExpanded} />
        </>
      ) : (
        <>
          <span className="file-tree-file-accessible-dot">·</span>
          {isImage ? <ImageTypeIcon /> : isPdf ? <PdfTypeIcon /> : <FileTypeIcon />}
        </>
      )}
    </span>
  );

  if (isRenaming) {
    return (
      <div className="file-tree-row-wrap">
        <div
          className={rowClassName}
          data-node-path={node.path}
          data-node-type={node.type}
        >
          {icon}
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
        </div>
      </div>
    );
  }

  return (
    <div className="file-tree-row-wrap">
      <button
        className={rowClassName}
        data-node-path={node.path}
        data-node-type={node.type}
        draggable
        onDragEnd={onDragEnd}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isImage || isPdf) return;
          onStartRename();
        }}
        onClick={onActivate}
        type="button"
      >
        {icon}
        <span className="file-tree-name">{node.name}</span>
        {isFolder ? (
          <span className="file-tree-folder-count">
            {t("files.folderFileCount", { count: fileCount ?? 0 })}
          </span>
        ) : null}
      </button>
      {onTogglePin ? (
        <button
          aria-label={isPinned ? t("files.unpinSidebar") : t("files.pinSidebar")}
          className={`file-tree-pin-btn${isPinned ? " pinned" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(node.path); }}
          title={isPinned ? t("files.unpin") : t("files.pin")}
          type="button"
        >
          <PinFileIcon />
        </button>
      ) : null}
    </div>
  );
});

function PinFileIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function FileTypeIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="file-tree-file-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1"
      viewBox="0 0 24 24"
    >
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M11 18h2" />
      <path d="M12 12v6" />
      <path d="M9 13v-.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5" />
    </svg>
  );
}

function ImageTypeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="file-tree-file-icon" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="15">
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function PdfTypeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="file-tree-file-icon" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24" width="15">
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.7.7l3.6 3.6A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2Z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M7.5 17h1.2a1.3 1.3 0 0 0 0-2.6H7.5v4.1" />
      <path d="M12 18.5v-4.1h1a2 2 0 0 1 0 4.1Z" />
      <path d="M16.4 18.5v-4.1h2.1" />
      <path d="M16.4 16.4h1.6" />
    </svg>
  );
}

function FolderStateIcon({ isExpanded }: { isExpanded: boolean }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="file-tree-folder-icon"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      {isExpanded ? (
        <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
      ) : (
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      )}
    </svg>
  );
}
