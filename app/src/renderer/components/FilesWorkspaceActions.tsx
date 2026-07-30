import type { MouseEvent as ReactMouseEvent, ReactElement } from "react";

import type { WorkspaceAvailability, WorkspaceSummary } from "../../shared/ipc";
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
  onOpenQuickSwitcher: () => void;
}

interface FilesWorkspaceRecoveryProps {
  availability: WorkspaceAvailability;
  isRefreshingWorkspace: boolean;
  isRelinkingWorkspace: boolean;
  onRelinkWorkspace: () => void;
  onRemoveWorkspace: () => void;
  onRetryWorkspace: () => void;
  onRevealWorkspace: () => void;
  workspace: WorkspaceSummary;
}

export function FilesCreateActions({
  isCreatingFile,
  isCreatingFolder,
  onCreateFile,
  onCreateFolder,
  onCollapseAllFolders,
  onExpandAllFolders,
  onOpenQuickSwitcher
}: FilesCreateActionsProps): ReactElement {
  const t = useT();
  const createFileLabel = isCreatingFile ? t("common.running") : t("files.createNote");
  const createFolderLabel = isCreatingFolder ? t("common.running") : t("files.createFolder");
  const expandAllLabel = t("files.expandAllFolders");
  const collapseAllLabel = t("files.collapseAllFolders");
  const searchLabel = t("nav.search");

  return (
    <div className="files-create-actions">
      <button aria-label={searchLabel} className="files-create-icon-button" onClick={onOpenQuickSwitcher} type="button">
        <SearchIcon />
      </button>
      <button aria-label={createFileLabel} className="files-create-icon-button" disabled={isCreatingFile} onClick={onCreateFile} type="button">
        <NewFileIcon />
      </button>
      <button aria-label={createFolderLabel} className="files-create-icon-button" disabled={isCreatingFolder} onClick={onCreateFolder} type="button">
        <NewFolderIcon />
      </button>
      <button aria-label={expandAllLabel} className="files-create-icon-button" onClick={onExpandAllFolders} type="button">
        <ExpandAllFoldersIcon />
      </button>
      <button aria-label={collapseAllLabel} className="files-create-icon-button" onClick={onCollapseAllFolders} type="button">
        <CollapseAllFoldersIcon />
      </button>
    </div>
  );
}

function SearchIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="lucide lucide-search-icon lucide-search" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

function NewFileIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function NewFolderIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M12 10.5v6m3-3H9m4.06-7.19-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

function ExpandAllFoldersIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M3 5h8" />
      <path d="M3 12h8" />
      <path d="M3 19h8" />
      <path d="m15 8 3-3 3 3" />
      <path d="m15 16 3 3 3-3" />
    </svg>
  );
}

function CollapseAllFoldersIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="22">
      <path d="M3 5h8" />
      <path d="M3 12h8" />
      <path d="M3 19h8" />
      <path d="m15 5 3 3 3-3" />
      <path d="m15 19 3-3 3 3" />
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
        className="secondary-button workspace-action-button"
        disabled={isOpeningWorkspace || isCreatingWorkspace}
        onClick={onOpenWorkspace}
        type="button"
      >
        <OpenWorkspaceIcon />
        {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
      </button>
      <button
        className="secondary-button workspace-action-button"
        disabled={isOpeningWorkspace || isCreatingWorkspace}
        onClick={onCreateWorkspace}
        type="button"
      >
        <CreateWorkspaceIcon />
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
          className="primary-button workspace-action-button"
          disabled={isOpeningWorkspace || isCreatingWorkspace}
          onClick={onOpenWorkspace}
          type="button"
        >
          <OpenWorkspaceIcon />
          {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
        </button>
        <button
          className="secondary-button workspace-action-button"
          disabled={isOpeningWorkspace || isCreatingWorkspace}
          onClick={onCreateWorkspace}
          type="button"
        >
          <CreateWorkspaceIcon />
          {isCreatingWorkspace ? t("files.creatingWorkspace") : t("files.createNewWorkspace")}
        </button>
      </div>
    </div>
  );
}

export function FilesWorkspaceRecovery({
  availability,
  isRefreshingWorkspace,
  isRelinkingWorkspace,
  onRelinkWorkspace,
  onRemoveWorkspace,
  onRetryWorkspace,
  onRevealWorkspace,
  workspace
}: FilesWorkspaceRecoveryProps): ReactElement {
  const t = useT();
  const unavailable = availability.status === "unavailable";

  return (
    <section className={`workspace-recovery workspace-recovery--${availability.status}`}>
      <div>
        <p className="workspace-recovery-kicker">
          {unavailable ? t("files.workspaceUnavailableKicker") : t("files.workspaceDegradedKicker")}
        </p>
        <h2>{unavailable ? t("files.workspaceUnavailableTitle") : t("files.workspaceDegradedTitle")}</h2>
        <p className="workspace-recovery-copy">
          {unavailable ? t("files.workspaceUnavailableCopy") : t("files.workspaceDegradedCopy")}
        </p>
      </div>
      <dl className="workspace-recovery-path">
        <dt>{t("files.workspaceRegisteredPath")}</dt>
        <dd>{workspace.path}</dd>
      </dl>
      <ul className="workspace-recovery-issues">
        {availability.issues.map((issue, index) => (
          <li key={`${issue.area}:${issue.kind}:${index}`}>
            <strong>{t(workspaceIssueAreaKey(issue.area))}</strong>
            <span>{t(workspaceIssueKindKey(issue.kind))}</span>
            {issue.details ? (
              <details>
                <summary>{t("files.workspaceErrorDetails")}</summary>
                <code>{issue.details}</code>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="workspace-recovery-actions">
        <button
          className="primary-button"
          disabled={isRefreshingWorkspace}
          onClick={onRetryWorkspace}
          type="button"
        >
          {isRefreshingWorkspace ? t("common.running") : t("files.workspaceRetry")}
        </button>
        <button
          className="secondary-button"
          disabled={isRelinkingWorkspace}
          onClick={onRelinkWorkspace}
          type="button"
        >
          {isRelinkingWorkspace ? t("common.running") : t("files.workspaceRelink")}
        </button>
        <button className="secondary-button" onClick={onRevealWorkspace} type="button">
          {t("files.revealInFinder")}
        </button>
        <button className="secondary-button" onClick={onRemoveWorkspace} type="button">
          {t("files.workspaceRemoveRegistration")}
        </button>
      </div>
      <p className="workspace-recovery-note">{t("files.workspaceRecoveryDoesNotChangeMarkdown")}</p>
    </section>
  );
}

function workspaceIssueAreaKey(
  area: WorkspaceAvailability["issues"][number]["area"]
): "files.workspaceIssueFileIndex" | "files.workspaceIssueFileTree" | "files.workspaceIssueSettings" {
  if (area === "file-tree") return "files.workspaceIssueFileTree";
  if (area === "file-index") return "files.workspaceIssueFileIndex";
  return "files.workspaceIssueSettings";
}

function workspaceIssueKindKey(
  kind: WorkspaceAvailability["issues"][number]["kind"]
):
  | "files.workspaceIssueCorrupt"
  | "files.workspaceIssueMissing"
  | "files.workspaceIssuePermission"
  | "files.workspaceIssueTemporary"
  | "files.workspaceIssueUnknown"
  | "files.workspaceIssueUnsupported" {
  if (kind === "missing") return "files.workspaceIssueMissing";
  if (kind === "permission") return "files.workspaceIssuePermission";
  if (kind === "temporary") return "files.workspaceIssueTemporary";
  if (kind === "corrupt") return "files.workspaceIssueCorrupt";
  if (kind === "unsupported") return "files.workspaceIssueUnsupported";
  return "files.workspaceIssueUnknown";
}

function OpenWorkspaceIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function CreateWorkspaceIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M12 7v6" />
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M9 10h6" />
    </svg>
  );
}
