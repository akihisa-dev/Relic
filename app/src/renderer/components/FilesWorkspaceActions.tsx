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

  return (
    <>
      <button
        className="primary-button"
        disabled={isCreatingFile}
        onClick={onCreateFile}
        type="button"
      >
        {isCreatingFile ? t("common.running") : t("files.createNote")}
      </button>
      <button
        className="secondary-button"
        disabled={isCreatingFolder}
        onClick={onCreateFolder}
        type="button"
      >
        {isCreatingFolder ? t("common.running") : t("files.createFolder")}
      </button>
    </>
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
