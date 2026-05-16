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
              <span aria-hidden="true" className="file-tree-folder-icon" />
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
