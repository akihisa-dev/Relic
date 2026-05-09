import { useMemo } from "react";
import type { ReactElement } from "react";

import type { MarkdownTemplateSummary, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
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
  onDeleteItem: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDuplicateFile: (path: string) => void;
  onFileNameDraftChange: (v: string) => void;
  onFolderNameDraftChange: (v: string) => void;
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
  fileNameDraft,
  folderNameDraft,
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFolder,
  onCreateWorkspace,
  onDeleteItem,
  onDuplicateFile,
  onFileNameDraftChange,
  onFolderNameDraftChange,
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
          <form
            className="new-file-form new-file-form--primary"
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
            <button className="primary-button" disabled={isCreatingFile} type="submit">
              {t("files.createNoteShort")}
            </button>
          </form>
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
