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
            <span className="file-tree-file-dot">·</span>
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

function FolderStateIcon({ isExpanded }: { isExpanded: boolean }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="file-tree-folder-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      {isExpanded ? (
        <path
          d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
