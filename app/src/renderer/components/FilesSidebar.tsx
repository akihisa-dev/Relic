import { useMemo } from "react";
import type { ReactElement } from "react";

import type { WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";
import { FileTree, FileTreeItem, findNodeByPath } from "./FileTree";

export interface FilesSidebarProps {
  activePaths: Set<string>;
  fileNameDraft: string;
  folderNameDraft: string;
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onCreateWorkspace: () => void;
  onFileNameDraftChange: (v: string) => void;
  onFolderNameDraftChange: (v: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onOpenWorkspace: () => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSwitchWorkspace: (id: string) => void;
  onTogglePin: (path: string) => void;
  workspaceState: WorkspaceState | null;
}

export function FilesSidebar({
  activePaths,
  fileNameDraft,
  folderNameDraft,
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFolder,
  onCreateWorkspace,
  onFileNameDraftChange,
  onFolderNameDraftChange,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onOpenWorkspace,
  onSelectFolder,
  onSwitchWorkspace,
  onTogglePin,
  workspaceState
}: FilesSidebarProps): ReactElement {
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const pinnedPaths = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const t = useT();

  return (
    <div className="sidebar-section">
      <div className="workspace-card">
        <div className="workspace-name" title={activeWorkspace?.path}>
          {activeWorkspace ? activeWorkspace.name : t("files.noWorkspace")}
        </div>
      </div>
      <button
        className="primary-button"
        disabled={isOpeningWorkspace || isCreatingWorkspace}
        onClick={onOpenWorkspace}
        type="button"
      >
        {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
      </button>
      <button
        className="secondary-button"
        disabled={isOpeningWorkspace || isCreatingWorkspace}
        onClick={onCreateWorkspace}
        type="button"
      >
        {isCreatingWorkspace ? t("files.creatingWorkspace") : t("files.createNewWorkspace")}
      </button>
      {workspaceState && workspaceState.workspaces.length > 1 ? (
        <div className="workspace-list" aria-label="Registered workspaces">
          {workspaceState.workspaces.map((ws) => (
            <button
              className={`workspace-list-item${ws.id === activeWorkspace?.id ? " active" : ""}`}
              key={ws.id}
              onClick={() => onSwitchWorkspace(ws.id)}
              title={ws.path}
              type="button"
            >
              {ws.name}
            </button>
          ))}
        </div>
      ) : null}
      {activeWorkspace ? (
        <>
          <form
            className="new-file-form"
            onSubmit={(e) => {
              e.preventDefault();
              onCreateFile();
            }}
          >
            <input
              aria-label={t("files.newNoteName")}
              className="text-input"
              onChange={(e) => onFileNameDraftChange(e.target.value)}
              placeholder={t("files.newNoteName")}
              value={fileNameDraft}
            />
            <button disabled={isCreatingFile} type="submit">
              {t("common.create")}
            </button>
          </form>
          <form
            className="new-file-form"
            onSubmit={(e) => {
              e.preventDefault();
              onCreateFolder();
            }}
          >
            <input
              aria-label={t("files.newFolderName")}
              className="text-input"
              onChange={(e) => onFolderNameDraftChange(e.target.value)}
              placeholder={t("files.newFolderName")}
              value={folderNameDraft}
            />
            <button disabled={isCreatingFolder} type="submit">
              {t("files.createFolder")}
            </button>
          </form>
          {pinnedPaths.size > 0 ? (
            <div className="pinned-section">
              <div className="pinned-section-heading">{t("files.pinned")}</div>
              <ul className="file-tree">
                {(workspaceState?.pinnedPaths ?? []).map((p) => {
                  const node = findNodeByPath(workspaceState?.fileTree ?? [], p);

                  if (!node) return null;

                  return (
                    <FileTreeItem
                      activePaths={activePaths}
                      isPinned
                      key={p}
                      node={node}
                      onMoveFile={onMoveFile}
                      onMoveFolder={onMoveFolder}
                      onOpenFile={onOpenFile}
                      onSelectFolder={onSelectFolder}
                      onTogglePin={onTogglePin}
                      pinnedPaths={pinnedPaths}
                    />
                  );
                })}
              </ul>
            </div>
          ) : null}
          <FileTree
            activePaths={activePaths}
            isRoot
            nodes={workspaceState?.fileTree ?? []}
            onMoveFile={onMoveFile}
            onMoveFolder={onMoveFolder}
            onOpenFile={onOpenFile}
            onSelectFolder={onSelectFolder}
            onTogglePin={onTogglePin}
            pinnedPaths={pinnedPaths}
          />
        </>
      ) : (
        <div className="empty-note">{t("files.workspaceHint")}</div>
      )}
    </div>
  );
}
