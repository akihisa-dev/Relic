import type { ReactElement } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { findNodeByPath, type FileTreeExpansionRequest } from "../fileTreeModel";
import { useT } from "../i18n";
import { FileTree, FileTreeItem, type FileTreeProps } from "./FileTree";

interface FilesSidebarTreeSectionProps extends Omit<FileTreeProps, "expansionRequest" | "isRoot" | "nodes" | "onDeleteSelectedItems" | "onRequestExpansion" | "pinnedPaths"> {
  expansionRequest?: FileTreeExpansionRequest;
  onDeleteSelectedItems: () => void;
  onRequestExpansion: (action: FileTreeExpansionRequest["action"], scopePath?: string) => void;
  pinnedPaths: Set<string>;
  workspaceState: WorkspaceState;
}

export function FilesSidebarTreeSection({
  expansionRequest,
  onDeleteSelectedItems,
  onRequestExpansion,
  pinnedPaths,
  workspaceState,
  ...fileTreeProps
}: FilesSidebarTreeSectionProps): ReactElement {
  const t = useT();
  const userNodes = workspaceState.fileTree;

  return (
    <>
      {pinnedPaths.size > 0 ? (
        <div className="pinned-section">
          <div className="pinned-section-heading">{t("files.pinned")}</div>
          <ul className="file-tree">
            {workspaceState.pinnedPaths.map((p) => {
              const node = findNodeByPath(workspaceState.fileTree, p);

              if (!node) return null;

              return (
                <FileTreeItem
                  key={p}
                  {...fileTreeProps}
                  expansionRequest={expansionRequest}
                  isPinned
                  node={node}
                  onDeleteSelectedItems={onDeleteSelectedItems}
                  onRequestExpansion={onRequestExpansion}
                  pinnedPaths={pinnedPaths}
                />
              );
            })}
          </ul>
        </div>
      ) : null}
      <FileTree
        {...fileTreeProps}
        expansionRequest={expansionRequest}
        isRoot
        nodes={userNodes}
        onDeleteSelectedItems={onDeleteSelectedItems}
        onRequestExpansion={onRequestExpansion}
        pinnedPaths={pinnedPaths}
      />
    </>
  );
}
