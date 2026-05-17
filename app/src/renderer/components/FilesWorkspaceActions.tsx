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
}

export function FilesCreateActions({
  isCreatingFile,
  isCreatingFolder,
  onCreateFile,
  onCreateFolder
}: FilesCreateActionsProps): ReactElement {
  const t = useT();
  const createFileLabel = isCreatingFile ? t("common.running") : t("files.createNote");
  const createFolderLabel = isCreatingFolder ? t("common.running") : t("files.createFolder");

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
    </div>
  );
}

function NewFileIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 20 20" width="20">
      <path d="M5 3.5h6.5L15 7v9.5H5z" />
      <path d="M11.5 3.5V7H15" />
      <path d="M10 9.5v5" />
      <path d="M7.5 12h5" />
    </svg>
  );
}

function NewFolderIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 20 20" width="20">
      <path d="M2.8 6.5h5l1.4 1.7h8v7.3H2.8z" />
      <path d="M2.8 6.5V5h5.4l1.3 1.5" />
      <path d="M10 9.5v4.2" />
      <path d="M7.9 11.6h4.2" />
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
