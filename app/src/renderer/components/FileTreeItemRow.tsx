import type { Dispatch, MouseEvent, ReactElement, RefObject, SetStateAction } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";

interface FileTreeItemRowProps {
  commitRename: () => void;
  cancelRename: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  isAppearing?: boolean;
  isExpanded: boolean;
  isOpen?: boolean;
  isPinned?: boolean;
  isRemoving: boolean;
  isRenaming: boolean;
  isSelected: boolean;
  node: WorkspaceTreeNode;
  onActivate: (event: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onStartRename: () => void;
  onTogglePin?: (path: string) => void;
  renameDraft: string;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  useSelectedItems: boolean;
}

export function FileTreeItemRow({
  cancelRename,
  commitRename,
  inputRef,
  isAppearing,
  isExpanded,
  isOpen,
  isPinned,
  isRemoving,
  isRenaming,
  isSelected,
  node,
  onActivate,
  onContextMenu,
  onStartRename,
  onTogglePin,
  renameDraft,
  setRenameDraft,
  useSelectedItems
}: FileTreeItemRowProps): ReactElement {
  const t = useT();
  const isFolder = node.type === "folder";

  return (
    <div className="file-tree-row-wrap">
      <button
        className={`file-tree-row ${node.type}${isOpen ? " open" : ""}${isSelected ? " selected" : ""}${useSelectedItems ? " multi-selected" : ""}${isAppearing ? " file-tree-row--appearing" : ""}${isRemoving ? " file-tree-row--removing" : ""}`}
        data-node-path={node.path}
        data-node-type={node.type}
        draggable={false}
        onContextMenu={onContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartRename();
        }}
        onClick={onActivate}
        type="button"
      >
        <span className={`file-tree-icon${isFolder ? " file-tree-icon--folder" : ""}${isFolder && isExpanded ? " file-tree-icon--expanded" : ""}`}>
          {node.type === "folder" ? (
            <>
              <span aria-hidden="true" className="file-tree-folder-chevron">▶</span>
              <FolderStateIcon isExpanded={isExpanded} />
            </>
          ) : (
            <>
              <span className="file-tree-file-accessible-dot">·</span>
              <FileTypeIcon />
            </>
          )}
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
    </div>
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
