import { useMemo } from "react";
import type { ReactElement } from "react";

import type { MarkdownTemplateSummary, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { useT } from "../i18n";
import { FileTree, FileTreeItem, findNodeByPath } from "./FileTree";

export interface FilesSidebarProps {
  activePaths: Set<string>;
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onCreateWorkspace: () => void;
  onDeleteItem: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDuplicateFile: (path: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onOpenWorkspace: () => void;
  onRenameItem: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin: (path: string) => void;
  onTemplatePathChange: (path: string) => void;
  selectedTemplatePath: string;
  templates: MarkdownTemplateSummary[];
  workspaceState: WorkspaceState | null;
}

export function FilesSidebar({
  activePaths,
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFolder,
  onCreateWorkspace,
  onDeleteItem,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onOpenWorkspace,
  onRenameItem,
  onSelectFolder,
  onTogglePin,
  onTemplatePathChange,
  selectedTemplatePath,
  templates,
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
      {activeWorkspace ? (
        <>
          <button
            className="primary-button"
            disabled={isCreatingFile}
            onClick={onCreateFile}
            type="button"
          >
            {isCreatingFile ? t("common.running") : t("files.createNote")}
          </button>
          {templates.length > 0 ? (
            <select
              aria-label={t("files.template")}
              className="template-select"
              onChange={(e) => onTemplatePathChange(e.target.value)}
              value={selectedTemplatePath}
            >
              <option value="">{t("files.noTemplate")}</option>
              {templates.map((template) => (
                <option key={template.path} value={template.path}>
                  {template.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            className="secondary-button"
            disabled={isCreatingFolder}
            onClick={onCreateFolder}
            type="button"
          >
            {isCreatingFolder ? t("common.running") : t("files.createFolder")}
          </button>
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
                  );
                })}
              </ul>
            </div>
          ) : null}
          <FileTree
            activePaths={activePaths}
            isRoot
            nodes={workspaceState?.fileTree ?? []}
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
          <div className="workspace-actions">
            <button
              className="secondary-button"
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
          </div>
        </>
      ) : (
        <div className="workspace-empty">
          <div>
            <p className="workspace-empty-title">{t("files.workspaceEmptyTitle")}</p>
            <p className="workspace-empty-copy">{t("files.workspaceHint")}</p>
          </div>
          <div className="workspace-empty-actions">
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
          </div>
        </div>
      )}
    </div>
  );
}
