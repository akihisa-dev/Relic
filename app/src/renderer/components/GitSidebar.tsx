import type { ReactElement } from "react";

import type {
  GitCommitDiff,
  GitCommitSummary,
  GitConflict,
  GitHubAuthStatus,
  GitRemoteSummary,
  GitStatus,
  GitSyncPreview,
  GitWorkingChange
} from "../../shared/ipc";
import { useT } from "../i18n";

export interface GitSidebarProps {
  gitStatus: GitStatus | null;
  gitHubAuthStatus: GitHubAuthStatus | null;
  gitRemotes: GitRemoteSummary[];
  gitCommitHistory: GitCommitSummary[];
  gitWorkingChanges: GitWorkingChange[];
  selectedGitCommitHash: string | null;
  selectedGitCommitDiff: GitCommitDiff | null;
  gitRemoteUrl: string;
  gitSyncMessage: string | null;
  gitErrorMessage: string | null;
  gitRetryAction: (() => void) | null;
  gitCommitMessage: string;
  gitSyncPreview: GitSyncPreview | null;
  gitSyncStep: "push-preview" | "pull-preview" | "pull-fetching" | null;
  gitConflicts: GitConflict[];
  gitCloneUrl: string;
  isCreatingGitCommit: boolean;
  isConnectingGitHub: boolean;
  isConnectingGitRemote: boolean;
  isDisconnectingGitHub: boolean;
  isPullingGitBranch: boolean;
  isPushingGitBranch: boolean;
  isCloningGitHub: boolean;
  isResolvingConflict: boolean;
  hasWorkspace: boolean;
  onInitializeGitRepository: () => void;
  onCloneGitHubRepository: () => void;
  onConnectGitHubAccount: () => void;
  onDisconnectGitHubAccount: () => void;
  onConnectGitRemote: () => void;
  onPushGitBranch: () => void;
  onPullGitBranch: () => void;
  onConfirmPush: () => void;
  onConfirmPull: () => void;
  onCreateGitCommit: () => void;
  onResolveConflict: (path: string, resolution: "ours" | "theirs") => void;
  onSelectCommitHash: (hash: string | null) => void;
  onSetGitRemoteUrl: (v: string) => void;
  onSetGitSyncStep: (step: "push-preview" | "pull-preview" | "pull-fetching" | null) => void;
  onSetGitCommitMessage: (v: string) => void;
  onSetGitCloneUrl: (v: string) => void;
}

export function GitSidebar({
  gitStatus,
  gitHubAuthStatus,
  gitRemotes,
  gitCommitHistory,
  gitWorkingChanges,
  selectedGitCommitHash,
  selectedGitCommitDiff,
  gitRemoteUrl,
  gitSyncMessage,
  gitErrorMessage,
  gitRetryAction,
  gitCommitMessage,
  gitSyncPreview,
  gitSyncStep,
  gitConflicts,
  gitCloneUrl,
  isCreatingGitCommit,
  isConnectingGitHub,
  isConnectingGitRemote,
  isDisconnectingGitHub,
  isPullingGitBranch,
  isPushingGitBranch,
  isCloningGitHub,
  isResolvingConflict,
  hasWorkspace,
  onInitializeGitRepository,
  onCloneGitHubRepository,
  onConnectGitHubAccount,
  onDisconnectGitHubAccount,
  onConnectGitRemote,
  onPushGitBranch,
  onPullGitBranch,
  onConfirmPush,
  onConfirmPull,
  onCreateGitCommit,
  onResolveConflict,
  onSelectCommitHash,
  onSetGitRemoteUrl,
  onSetGitSyncStep,
  onSetGitCommitMessage,
  onSetGitCloneUrl
}: GitSidebarProps): ReactElement {
  const t = useT();
  const isGitBusy =
    isCreatingGitCommit ||
    isConnectingGitHub ||
    isConnectingGitRemote ||
    isDisconnectingGitHub ||
    isPullingGitBranch ||
    isPushingGitBranch ||
    isCloningGitHub ||
    isResolvingConflict ||
    gitSyncStep === "pull-fetching";

  if (!hasWorkspace) {
    return (
      <div className="sidebar-section">
        <div className="empty-note">{t("empty.noWorkspaceGit")}</div>
      </div>
    );
  }

  if (!gitStatus?.initialized) {
    return (
      <div className="sidebar-section">
        <div className="search-block">
          <div className="empty-note">{t("git.notInitialized")}</div>
          <button className="primary-button" onClick={onInitializeGitRepository} type="button">
            {t("git.initialize")}
          </button>
        </div>
        {gitHubAuthStatus?.connected ? (
          <div className="search-block">
            <div className="setting-row">
              <span>{t("git.account")}</span>
              <span>{gitHubAuthStatus.login ?? "-"}</span>
            </div>
            <button
              className="replace-btn"
              disabled={isDisconnectingGitHub}
              onClick={onDisconnectGitHubAccount}
              type="button"
            >
              {isDisconnectingGitHub ? t("git.disconnectingAccount") : t("git.disconnectAccount")}
            </button>
            <div className="links-panel-subheading">{t("git.clone")}</div>
            <div className="empty-note">
              {t("git.cloneHint")}
            </div>
            <form
              className="git-form"
              onSubmit={(e) => { e.preventDefault(); onCloneGitHubRepository(); }}
            >
              <input
                aria-label={t("git.repositoryUrlToClone")}
                className="text-input"
                onChange={(e) => onSetGitCloneUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                value={gitCloneUrl}
              />
              <button
                className="primary-button"
                disabled={isCloningGitHub || !gitCloneUrl.trim()}
                type="submit"
              >
                {isCloningGitHub ? t("git.repositoryCloning") : t("git.repositoryClone")}
              </button>
            </form>
            {gitErrorMessage ? (
              <div className="error-note">{gitErrorMessage}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      {isGitBusy ? (
        <div className="list-loading-note">{t("common.loading")}</div>
      ) : null}
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.github")}</div>
        {gitHubAuthStatus?.connected ? (
          <>
            <div className="setting-row">
              <span>{t("git.connection")}</span>
              <span>{t("git.connected")}</span>
            </div>
            <div className="setting-row">
              <span>{t("git.account")}</span>
              <span>{gitHubAuthStatus.login ?? "-"}</span>
            </div>
            <div className="setting-row">
              <span>{t("git.scopes")}</span>
              <span>
                {gitHubAuthStatus.scopes.length > 0
                  ? gitHubAuthStatus.scopes.join(", ")
                  : "-"}
              </span>
            </div>
            <button
              className="replace-btn"
              disabled={isDisconnectingGitHub}
              onClick={onDisconnectGitHubAccount}
              type="button"
            >
              {isDisconnectingGitHub ? t("git.disconnectingAccount") : t("git.disconnectAccount")}
            </button>
          </>
        ) : (
          <>
            <div className="empty-note">
              {t("git.connectHint")}
            </div>
            {!gitHubAuthStatus?.configured ? (
              <div className="search-result-line">
                {t("git.connectRequired")}
              </div>
            ) : null}
            <button
              className="primary-button"
              disabled={isConnectingGitHub || gitHubAuthStatus?.configured === false}
              onClick={onConnectGitHubAccount}
              type="button"
            >
              {isConnectingGitHub ? t("git.connectingAccount") : t("git.connectAccount")}
            </button>
          </>
        )}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.remote")}</div>
        <form
          className="git-form"
          onSubmit={(event) => {
            event.preventDefault();
            onConnectGitRemote();
          }}
        >
          <input
            aria-label={t("git.originUrl")}
            className="text-input"
            onChange={(event) => onSetGitRemoteUrl(event.target.value)}
            placeholder="https://github.com/owner/repo"
            value={gitRemoteUrl}
          />
          <button
            className="primary-button"
            disabled={isConnectingGitRemote}
            type="submit"
          >
            {isConnectingGitRemote ? t("git.connectingOrigin") : t("git.connectOrigin")}
          </button>
        </form>
        {gitRemotes.length > 0 ? (
          <ul className="search-results">
            {gitRemotes.map((remote) => (
              <li className="search-result-item" key={remote.name}>
                <div className="search-result-button">
                  <span className="search-result-title">
                    {remote.name}
                    {remote.isOrigin ? " (origin)" : ""}
                  </span>
                  <span className="search-result-line">{remote.url}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">No GitHub repository connected yet.</div>
        )}
        {gitSyncStep === "pull-fetching" ? (
          <div className="empty-note">Checking GitHub changes...</div>
        ) : gitSyncStep === "push-preview" && gitSyncPreview ? (
          <div className="git-sync-preview">
            <div className="setting-row">
              <span>{t("git.destination")}</span>
              <span>{gitSyncPreview.remoteName}</span>
            </div>
            <div className="search-result-line">{gitSyncPreview.remoteUrl}</div>
            <div className="links-panel-subheading">{t("git.outgoingChanges")}</div>
            {gitSyncPreview.outgoingChanges.length > 0 ? (
              <ul className="search-results">
                {gitSyncPreview.outgoingChanges.map((c) => (
                  <li className="search-result-item" key={c.path}>
                    <div className="search-result-button">
                      <span className="search-result-title">{c.path}</span>
                      <span className="search-result-line">{c.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-note">{t("git.noChanges")}</div>
            )}
            {gitSyncPreview.incomingCommits.length > 0 ? (
              <>
                <div className="links-panel-subheading">{t("git.incomingCommits")}</div>
                <ul className="search-results">
                  {gitSyncPreview.incomingCommits.map((c) => (
                    <li className="search-result-item" key={c.hash}>
                      <div className="search-result-button">
                        <span className="search-result-title">{c.message}</span>
                        <span className="search-result-line">{c.author}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="git-action-row">
              <button
                className="primary-button"
                disabled={isPushingGitBranch}
                onClick={onConfirmPush}
                type="button"
              >
                {isPushingGitBranch ? t("git.pushing") : t("git.push")}
              </button>
              <button
                className="replace-btn"
                onClick={() => onSetGitSyncStep(null)}
                type="button"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : gitSyncStep === "pull-preview" && gitSyncPreview ? (
          <div className="git-sync-preview">
            <div className="setting-row">
              <span>{t("git.source")}</span>
              <span>{gitSyncPreview.remoteName}</span>
            </div>
            <div className="search-result-line">{gitSyncPreview.remoteUrl}</div>
            <div className="links-panel-subheading">{t("git.incomingCommits")}</div>
            {gitSyncPreview.incomingCommits.length > 0 ? (
              <ul className="search-results">
                {gitSyncPreview.incomingCommits.map((c) => (
                  <li className="search-result-item" key={c.hash}>
                    <div className="search-result-button">
                      <span className="search-result-title">{c.message}</span>
                      <span className="search-result-line">{c.author}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-note">{t("git.noIncoming")}</div>
            )}
            {gitSyncPreview.outgoingChanges.length > 0 ? (
              <>
                <div className="links-panel-subheading">{t("git.uncommittedChanges")}</div>
                <ul className="search-results">
                  {gitSyncPreview.outgoingChanges.map((c) => (
                    <li className="search-result-item" key={c.path}>
                      <div className="search-result-button">
                        <span className="search-result-title">{c.path}</span>
                        <span className="search-result-line">{c.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="git-action-row">
              <button
                className="primary-button"
                disabled={isPullingGitBranch || gitSyncPreview.outgoingChanges.length > 0}
                onClick={onConfirmPull}
                type="button"
              >
                {isPullingGitBranch ? t("git.pulling") : t("git.pull")}
              </button>
              <button
                className="replace-btn"
                onClick={() => onSetGitSyncStep(null)}
                type="button"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="git-action-row">
            <button
              className="replace-btn"
              disabled={isPullingGitBranch || !gitHubAuthStatus?.connected || gitRemotes.length === 0}
              onClick={onPullGitBranch}
              type="button"
            >
              Pull
            </button>
            <button
              className="primary-button"
              disabled={isPushingGitBranch || !gitHubAuthStatus?.connected || gitRemotes.length === 0}
              onClick={onPushGitBranch}
              type="button"
            >
              Push
            </button>
          </div>
        )}
        {gitSyncMessage ? <div className="search-result-line">{gitSyncMessage}</div> : null}
        {gitErrorMessage ? (
          <div className="git-error-block">
            <div className="error-note">{gitErrorMessage}</div>
            {gitRetryAction ? (
              <button className="replace-btn" onClick={gitRetryAction} type="button">
                {t("git.retry")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {gitConflicts.length > 0 ? (
        <div className="search-block">
          <div className="links-panel-subheading">{t("git.conflicts")}</div>
          <div className="error-note">
            {t("git.conflictPrompt")}
          </div>
          <ul className="search-results">
            {gitConflicts.map((conflict) => (
              <li className="search-result-item" key={conflict.path}>
                <div className="search-result-button">
                  <span className="search-result-title">{conflict.path}</span>
                </div>
                <div className="git-action-row">
                  <button
                    className="replace-btn"
                    disabled={isResolvingConflict}
                    onClick={() => onResolveConflict(conflict.path, "ours")}
                    type="button"
                  >
                    {t("git.conflictChooseOurs")}
                  </button>
                  <button
                    className="replace-btn"
                    disabled={isResolvingConflict}
                    onClick={() => onResolveConflict(conflict.path, "theirs")}
                    type="button"
                  >
                    {t("git.conflictChooseTheirs")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.repository")}</div>
        <div className="setting-row">
          <span>{t("git.status")}</span>
          <span>{t("git.initialized")}</span>
        </div>
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.commit")}</div>
        <input
          aria-label={t("git.commitMessage")}
          className="text-input"
          onChange={(event) => onSetGitCommitMessage(event.target.value)}
          placeholder={t("git.commitMessage")}
          value={gitCommitMessage}
        />
        <button
          className="primary-button"
          disabled={isCreatingGitCommit}
          onClick={onCreateGitCommit}
          type="button"
        >
          {isCreatingGitCommit ? t("git.commitCreating") : t("git.commitCreate")}
        </button>
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.changes")}</div>
        {gitWorkingChanges.length > 0 ? (
          <ul className="search-results">
            {gitWorkingChanges.map((change) => (
              <li className="search-result-item" key={`${change.status}-${change.path}`}>
                <div className="search-result-button">
                  <span className="search-result-title">{change.path}</span>
                  <span className="search-result-line">{change.status}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("git.noUncommitted")}</div>
        )}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.history")}</div>
        {gitCommitHistory.length > 0 ? (
          <ul className="search-results">
            {gitCommitHistory.map((commit) => (
              <li className="search-result-item" key={commit.hash}>
                <button
                  className="search-result-button"
                  onClick={() => onSelectCommitHash(commit.hash)}
                  type="button"
                >
                  <span className="search-result-title">{commit.message}</span>
                  <span className="search-result-line">
                    {commit.author} · {new Date(commit.date).toLocaleString("ja-JP")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("git.commitHistoryEmpty")}</div>
        )}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.diff")}</div>
        {selectedGitCommitDiff && selectedGitCommitDiff.entries.length > 0 ? (
          <div className="git-diff-list">
            {selectedGitCommitDiff.entries.map((entry) => (
              <div className="git-diff-entry" key={`${selectedGitCommitDiff.commit.hash}-${entry.path}`}>
                <div className="git-diff-meta">
                  <span className="search-result-title">{entry.path}</span>
                  <span className="search-result-line">{entry.status}</span>
                </div>
                <div className="git-diff-columns">
                  <div className="git-diff-column">
                    <div className="links-panel-subheading">{t("git.diffBefore")}</div>
                    <pre className="git-diff-code">{entry.before}</pre>
                  </div>
                  <div className="git-diff-column">
                    <div className="links-panel-subheading">{t("git.diffAfter")}</div>
                    <pre className="git-diff-code">{entry.after}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : selectedGitCommitHash ? (
          <div className="empty-note">{t("git.noCommitDiff")}</div>
        ) : (
          <div className="empty-note">{t("git.selectCommitForDiff")}</div>
        )}
      </div>
    </div>
  );
}
