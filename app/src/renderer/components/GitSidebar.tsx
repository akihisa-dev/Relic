import type { ReactElement } from "react";

import type {
  GitBranchSummary,
  GitCommitDiff,
  GitCommitSummary,
  GitConflict,
  GitHubAuthStatus,
  GitRemoteSummary,
  GitStatus,
  GitSyncPreview,
  GitTagSummary,
  GitWorkingChange
} from "../../shared/ipc";
import { useT } from "../i18n";

export interface GitSidebarProps {
  gitStatus: GitStatus | null;
  gitHubAuthStatus: GitHubAuthStatus | null;
  gitRemotes: GitRemoteSummary[];
  gitBranches: GitBranchSummary[];
  gitCommitHistory: GitCommitSummary[];
  gitTags: GitTagSummary[];
  gitWorkingChanges: GitWorkingChange[];
  selectedGitCommitHash: string | null;
  selectedGitCommitDiff: GitCommitDiff | null;
  newGitBranchName: string;
  newGitTagName: string;
  newGitTagMessage: string;
  gitRemoteUrl: string;
  gitSyncMessage: string | null;
  gitErrorMessage: string | null;
  gitRetryAction: (() => void) | null;
  pendingGitBranchSwitch: string | null;
  gitCommitMessage: string;
  gitSyncPreview: GitSyncPreview | null;
  gitSyncStep: "push-preview" | "pull-preview" | "pull-fetching" | null;
  gitConflicts: GitConflict[];
  gitCloneUrl: string;
  isCreatingGitBranch: boolean;
  isCreatingGitCommit: boolean;
  isCreatingGitTag: boolean;
  isConnectingGitHub: boolean;
  isConnectingGitRemote: boolean;
  isDeletingGitTag: boolean;
  isDisconnectingGitHub: boolean;
  isPullingGitBranch: boolean;
  isPushingGitBranch: boolean;
  pushingGitTagName: string | null;
  isSwitchingGitBranch: boolean;
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
  onCreateGitBranch: () => void;
  onSwitchGitBranch: (name: string, allowDirty?: boolean) => void;
  onCommitAndSwitchGitBranch: () => void;
  onCreateGitCommit: () => void;
  onCreateGitTag: () => void;
  onDeleteGitTag: (name: string) => void;
  onPushGitTag: (name: string) => void;
  onResolveConflict: (path: string, resolution: "ours" | "theirs") => void;
  onSelectCommitHash: (hash: string | null) => void;
  onSetNewGitBranchName: (v: string) => void;
  onSetNewGitTagName: (v: string) => void;
  onSetNewGitTagMessage: (v: string) => void;
  onSetGitRemoteUrl: (v: string) => void;
  onSetGitSyncStep: (step: "push-preview" | "pull-preview" | "pull-fetching" | null) => void;
  onSetPendingGitBranchSwitch: (branch: string | null) => void;
  onSetGitCommitMessage: (v: string) => void;
  onSetGitCloneUrl: (v: string) => void;
}

export function GitSidebar({
  gitStatus,
  gitHubAuthStatus,
  gitRemotes,
  gitBranches,
  gitCommitHistory,
  gitTags,
  gitWorkingChanges,
  selectedGitCommitHash,
  selectedGitCommitDiff,
  newGitBranchName,
  newGitTagName,
  newGitTagMessage,
  gitRemoteUrl,
  gitSyncMessage,
  gitErrorMessage,
  gitRetryAction,
  pendingGitBranchSwitch,
  gitCommitMessage,
  gitSyncPreview,
  gitSyncStep,
  gitConflicts,
  gitCloneUrl,
  isCreatingGitBranch,
  isCreatingGitCommit,
  isCreatingGitTag,
  isConnectingGitHub,
  isConnectingGitRemote,
  isDeletingGitTag,
  isDisconnectingGitHub,
  isPullingGitBranch,
  isPushingGitBranch,
  pushingGitTagName,
  isSwitchingGitBranch,
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
  onCreateGitBranch,
  onSwitchGitBranch,
  onCommitAndSwitchGitBranch,
  onCreateGitCommit,
  onCreateGitTag,
  onDeleteGitTag,
  onPushGitTag,
  onResolveConflict,
  onSelectCommitHash,
  onSetNewGitBranchName,
  onSetNewGitTagName,
  onSetNewGitTagMessage,
  onSetGitRemoteUrl,
  onSetGitSyncStep,
  onSetPendingGitBranchSwitch,
  onSetGitCommitMessage,
  onSetGitCloneUrl
}: GitSidebarProps): ReactElement {
  const t = useT();
  const isGitBusy =
    isCreatingGitBranch ||
    isCreatingGitCommit ||
    isCreatingGitTag ||
    isConnectingGitHub ||
    isConnectingGitRemote ||
    isDeletingGitTag ||
    isDisconnectingGitHub ||
    isPullingGitBranch ||
    isPushingGitBranch ||
    pushingGitTagName !== null ||
    isSwitchingGitBranch ||
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
              className="git-branch-form"
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
          className="git-branch-form"
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
              <span>{gitSyncPreview.upstream}</span>
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
            <div className="git-branch-warning-actions">
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
              <span>{gitSyncPreview.upstream}</span>
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
            <div className="git-branch-warning-actions">
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
          <div className="git-branch-warning-actions">
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
                <div className="git-branch-warning-actions">
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
        <div className="setting-row">
          <span>{t("git.branch")}</span>
          <span>{gitStatus.currentBranch ?? "(detached)"}</span>
        </div>
        <div className="setting-row">
          <span>{t("git.upstream")}</span>
          <span>{gitBranches.find((branch) => branch.isCurrent)?.upstream ?? t("common.none")}</span>
        </div>
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("git.branches")}</div>
        <form
          className="git-branch-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreateGitBranch();
          }}
        >
          <input
            aria-label={t("git.branchName")}
            className="text-input"
            onChange={(event) => onSetNewGitBranchName(event.target.value)}
            placeholder="feature/..."
            value={newGitBranchName}
          />
          <button
            className="primary-button"
            disabled={isCreatingGitBranch}
            type="submit"
          >
            {isCreatingGitBranch ? t("git.branchCreating") : t("git.branchCreate")}
          </button>
        </form>
        {gitBranches.length > 0 ? (
          <ul className="search-results git-branch-list">
            {gitBranches.map((branch) => (
              <li className="search-result-item" key={branch.name}>
                <button
                  className="search-result-button"
                  disabled={branch.isCurrent || isSwitchingGitBranch}
                  onClick={() => onSwitchGitBranch(branch.name)}
                  type="button"
                >
                  <span className="search-result-title">
                    {branch.name}
                    {branch.isCurrent ? " (current)" : ""}
                  </span>
                  <span className="search-result-line">
                    {branch.upstream ?? (branch.isCurrent ? t("git.currentBranch") : t("git.switch"))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("git.noBranches")}</div>
        )}
        {pendingGitBranchSwitch ? (
          <div className="git-branch-warning">
            <div className="error-note">
              Uncommitted changes exist. Choose how to switch to `{pendingGitBranchSwitch}`.
            </div>
            <div className="git-branch-warning-actions">
              <button
                className="primary-button"
                disabled={isCreatingGitCommit || isSwitchingGitBranch}
                onClick={onCommitAndSwitchGitBranch}
                type="button"
              >
                {t("git.switchCommit")}
              </button>
              <button
                className="replace-btn"
                disabled={isSwitchingGitBranch}
                onClick={() => onSwitchGitBranch(pendingGitBranchSwitch, true)}
                type="button"
              >
                {t("git.switchAllowDirty")}
              </button>
              <button
                className="replace-btn"
                disabled={isCreatingGitCommit || isSwitchingGitBranch}
                onClick={() => onSetPendingGitBranchSwitch(null)}
                type="button"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        ) : null}
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
        <div className="links-panel-subheading">{t("git.tags")}</div>
        <div className="git-tag-target">
          {selectedGitCommitHash
            ? t("git.tagTarget", { hash: selectedGitCommitHash.slice(0, 7) })
            : t("git.selectCommitForTag")}
        </div>
        <input
          aria-label={t("git.tagName")}
          className="text-input"
          onChange={(event) => onSetNewGitTagName(event.target.value)}
          placeholder="v1.0.0"
          value={newGitTagName}
        />
        <input
          aria-label={t("git.tagMemo")}
          className="text-input"
          onChange={(event) => onSetNewGitTagMessage(event.target.value)}
          placeholder={t("git.tagMemoPlaceholder")}
          value={newGitTagMessage}
        />
        <button
          className="primary-button"
          disabled={isCreatingGitTag || !selectedGitCommitHash}
          onClick={onCreateGitTag}
          type="button"
        >
          {isCreatingGitTag ? t("git.tagCreating") : t("git.tagCreate")}
        </button>
        {gitTags.length > 0 ? (
          <ul className="search-results git-tag-list">
            {gitTags.map((tag) => (
              <li className="search-result-item" key={tag.name}>
                <div className="git-tag-row">
                  <button
                    className="search-result-button"
                    onClick={() => onSelectCommitHash(tag.targetHash)}
                    type="button"
                  >
                    <span className="search-result-title">
                      {tag.name}
                      {tag.annotated ? " (annotated)" : ""}
                    </span>
                    <span className="search-result-line">
                      {tag.targetHash.slice(0, 7)} · {new Date(tag.date).toLocaleString("ja-JP")}
                    </span>
                    {tag.message ? (
                      <span className="search-result-line">{tag.message}</span>
                    ) : tag.targetMessage ? (
                      <span className="search-result-line">{tag.targetMessage}</span>
                    ) : null}
                  </button>
                  <button
                    className="replace-btn"
                    disabled={isDeletingGitTag}
                    onClick={() => onDeleteGitTag(tag.name)}
                    type="button"
                  >
                    {t("git.tagDelete")}
                  </button>
                  <button
                    className="replace-btn"
                    disabled={
                      pushingGitTagName === tag.name ||
                      !gitHubAuthStatus?.connected ||
                      gitRemotes.length === 0
                    }
                    onClick={() => onPushGitTag(tag.name)}
                    type="button"
                  >
                    {pushingGitTagName === tag.name ? t("git.pushing") : "Push"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("git.tagsEmpty")}</div>
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
