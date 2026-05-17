import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { useT } from "../i18n";

interface FilesWorkspaceActionProps {
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateWorkspace: () => void;
  onOpenWorkspace: () => void;
}

interface FilesCreateActionsProps {
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  onCreateFile: (event?: ReactMouseEvent<HTMLButtonElement>) => void;
  onCreateFolder: (event?: ReactMouseEvent<HTMLButtonElement>) => void;
  onCollapseAllFolders: () => void;
  onExpandAllFolders: () => void;
}

export function FilesCreateActions({
  isCreatingFile,
  isCreatingFolder,
  onCreateFile,
  onCreateFolder,
  onCollapseAllFolders,
  onExpandAllFolders
}: FilesCreateActionsProps): ReactElement {
  const t = useT();
  const createFileLabel = isCreatingFile ? t("common.running") : t("files.createNote");
  const createFolderLabel = isCreatingFolder ? t("common.running") : t("files.createFolder");
  const expandAllLabel = t("files.expandAllFolders");
  const collapseAllLabel = t("files.collapseAllFolders");

  return (
    <div className="files-create-actions">
      <button
        aria-label={createFileLabel}
        className="files-create-icon-button"
        disabled={isCreatingFile}
        onClick={onCreateFile}
        title={createFileLabel}
        type="button"
      >
        <NewFileIcon />
      </button>
      <button
        aria-label={createFolderLabel}
        className="files-create-icon-button"
        disabled={isCreatingFolder}
        onClick={onCreateFolder}
        title={createFolderLabel}
        type="button"
      >
        <NewFolderIcon />
      </button>
      <button
        aria-label={expandAllLabel}
        className="files-create-icon-button"
        onClick={onExpandAllFolders}
        title={expandAllLabel}
        type="button"
      >
        <ExpandAllFoldersIcon />
      </button>
      <button
        aria-label={collapseAllLabel}
        className="files-create-icon-button"
        onClick={onCollapseAllFolders}
        title={collapseAllLabel}
        type="button"
      >
        <CollapseAllFoldersIcon />
      </button>
    </div>
  );
}

function NewFileIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 22 22" width="22">
      <path d="M4.5 5.5h7.2l4.8 4.8v7.2h-12z" />
      <path d="M11.7 5.5v4.8h4.8" />
      <path d="M8.2 14.6 15 7.8l2 2-6.8 6.8-2.8.8z" />
    </svg>
  );
}

function NewFolderIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 22 22" width="22">
      <path d="M3.5 7h5l1.8 2h8.2v8.5h-15z" />
      <path d="M3.5 7V5.5H9l1.5 1.5" />
      <path d="M11 10.5v4" />
      <path d="M9 12.5h4" />
    </svg>
  );
}

function ExpandAllFoldersIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 22 22" width="22">
      <path d="M4 12.5h14" />
      <path d="M7 8.5 11 4.5 15 8.5" />
      <path d="M7 16.5 11 12.5 15 16.5" />
    </svg>
  );
}

function CollapseAllFoldersIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 22 22" width="22">
      <path d="M4 9.5h14" />
      <path d="M4 14.5h14" />
      <path d="M7 4.5 11 8.5 15 4.5" />
      <path d="M7 19.5 11 15.5 15 19.5" />
    </svg>
  );
}

export function FilesWorkspaceActions({
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateWorkspace,
  onOpenWorkspace
}: FilesWorkspaceActionProps): ReactElement {
  const t = useT();

  return (
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
  );
}

export function FilesWorkspaceEmpty({
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateWorkspace,
  onOpenWorkspace
}: FilesWorkspaceActionProps): ReactElement {
  const t = useT();

  return (
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
  );
}
