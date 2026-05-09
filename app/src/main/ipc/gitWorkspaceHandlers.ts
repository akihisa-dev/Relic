import { ipcMain } from "electron";

import {
  connectGitRemoteChannel,
  type ConnectGitRemoteInput,
  createGitBranchChannel,
  type CreateGitBranchInput,
  createGitCommitChannel,
  type CreateGitCommitInput,
  createGitTagChannel,
  type CreateGitTagInput,
  deleteGitTagChannel,
  type DeleteGitTagInput,
  getGitBranchesChannel,
  getGitCommitDiffChannel,
  getGitCommitHistoryChannel,
  getGitConflictsChannel,
  getGitRemotesChannel,
  getGitStatusChannel,
  getGitSyncPreviewChannel,
  getGitTagsChannel,
  getGitWorkingChangesChannel,
  initializeGitRepositoryChannel,
  pullGitBranchChannel,
  pushGitBranchChannel,
  pushGitTagChannel,
  type PushGitTagInput,
  resolveGitConflictChannel,
  type ResolveGitConflictInput,
  switchGitBranchChannel,
  type SwitchGitBranchInput,
  type GitBranchSummary,
  type GitCommitDiff,
  type GitCommitSummary,
  type GitConflict,
  type GitRemoteSummary,
  type GitRemoteSyncResult,
  type GitStatus,
  type GitSyncPreview,
  type GitTagSummary,
  type GitWorkingChange
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  createGitBranch,
  createGitCommit,
  createGitTag,
  connectGitRemote,
  deleteGitTag,
  initializeGitRepository,
  pullGitBranch,
  pushGitBranch,
  pushGitTag,
  readGitBranches,
  readGitCommitDiff,
  readGitCommitHistory,
  readGitConflicts,
  readGitRemotes,
  readGitStatus,
  readGitSyncPreview,
  readGitTags,
  readGitWorkingChanges,
  resolveGitConflict,
  switchGitBranch
} from "../files/git";
import { readGitHubAuthFromKeychain } from "../github/keychain";
import { withActiveWorkspace } from "./activeWorkspace";

export function registerGitWorkspaceHandlers(): void {
  ipcMain.handle(getGitStatusChannel, async (): Promise<RelicResult<GitStatus>> => {
    return withActiveWorkspace(
      { code: "GIT_STATUS_FAILED", message: "Git状態を取得できませんでした。" },
      readGitStatus
    );
  });

  ipcMain.handle(getGitTagsChannel, async (): Promise<RelicResult<GitTagSummary[]>> => {
    return withActiveWorkspace(
      { code: "GIT_TAGS_FAILED", message: "Gitタグ一覧を取得できませんでした。" },
      readGitTags
    );
  });

  ipcMain.handle(getGitBranchesChannel, async (): Promise<RelicResult<GitBranchSummary[]>> => {
    return withActiveWorkspace(
      { code: "GIT_BRANCHES_FAILED", message: "ブランチ一覧を取得できませんでした。" },
      readGitBranches
    );
  });

  ipcMain.handle(getGitRemotesChannel, async (): Promise<RelicResult<GitRemoteSummary[]>> => {
    return withActiveWorkspace(
      { code: "GIT_REMOTES_FAILED", message: "GitHubリポジトリ接続を確認できませんでした。" },
      readGitRemotes
    );
  });

  ipcMain.handle(getGitWorkingChangesChannel, async (): Promise<RelicResult<GitWorkingChange[]>> => {
    return withActiveWorkspace(
      { code: "GIT_WORKING_CHANGES_FAILED", message: "変更一覧を取得できませんでした。" },
      readGitWorkingChanges
    );
  });

  ipcMain.handle(getGitCommitHistoryChannel, async (): Promise<RelicResult<GitCommitSummary[]>> => {
    return withActiveWorkspace(
      { code: "GIT_HISTORY_FAILED", message: "コミット履歴を取得できませんでした。" },
      readGitCommitHistory
    );
  });

  ipcMain.handle(getGitCommitDiffChannel, async (_event, hash: string): Promise<RelicResult<GitCommitDiff>> => {
    if (typeof hash !== "string" || hash.trim() === "") {
      return fail("GIT_COMMIT_NOT_FOUND", "表示するコミットを選択してください。");
    }

    return withActiveWorkspace(
      { code: "GIT_COMMIT_DIFF_FAILED", message: "コミット差分を取得できませんでした。" },
      (workspacePath) => readGitCommitDiff(workspacePath, hash)
    );
  });

  ipcMain.handle(initializeGitRepositoryChannel, async (): Promise<RelicResult<GitStatus>> => {
    return withActiveWorkspace(
      { code: "GIT_INIT_FAILED", message: "Gitリポジトリを初期化できませんでした。" },
      initializeGitRepository
    );
  });

  ipcMain.handle(createGitCommitChannel, async (_event, input: CreateGitCommitInput): Promise<RelicResult<GitCommitSummary>> => {
    if (!isCreateGitCommitInput(input)) {
      return fail("GIT_COMMIT_INVALID_INPUT", "コミットメッセージを入力してください。");
    }

    const author = await readGitHubAuthor();

    if (!author.ok) {
      return author;
    }

    return withActiveWorkspace(
      { code: "GIT_COMMIT_FAILED", message: "コミットを作成できませんでした。" },
      (workspacePath) => createGitCommit(workspacePath, { ...input, ...author.value })
    );
  });

  ipcMain.handle(createGitBranchChannel, async (_event, input: CreateGitBranchInput): Promise<RelicResult<GitBranchSummary[]>> => {
    if (!isCreateGitBranchInput(input)) {
      return fail("GIT_BRANCH_INVALID_INPUT", "ブランチ名を入力してください。");
    }

    return withActiveWorkspace(
      { code: "GIT_BRANCH_CREATE_FAILED", message: "ブランチを作成できませんでした。" },
      (workspacePath) => createGitBranch(workspacePath, input)
    );
  });

  ipcMain.handle(createGitTagChannel, async (_event, input: CreateGitTagInput): Promise<RelicResult<GitTagSummary[]>> => {
    if (!isCreateGitTagInput(input)) {
      return fail("GIT_TAG_INVALID_INPUT", "タグ名を入力してください。");
    }

    const tagInput = await withGitHubTagger(input);

    if (!tagInput.ok) {
      return tagInput;
    }

    return withActiveWorkspace(
      { code: "GIT_TAG_CREATE_FAILED", message: "Gitタグを作成できませんでした。" },
      (workspacePath) => createGitTag(workspacePath, tagInput.value)
    );
  });

  ipcMain.handle(deleteGitTagChannel, async (_event, input: DeleteGitTagInput): Promise<RelicResult<GitTagSummary[]>> => {
    if (!isDeleteGitTagInput(input)) {
      return fail("GIT_TAG_INVALID_INPUT", "削除するタグを選択してください。");
    }

    return withActiveWorkspace(
      { code: "GIT_TAG_DELETE_FAILED", message: "Gitタグを削除できませんでした。" },
      (workspacePath) => deleteGitTag(workspacePath, input)
    );
  });

  ipcMain.handle(connectGitRemoteChannel, async (_event, input: ConnectGitRemoteInput): Promise<RelicResult<GitRemoteSummary[]>> => {
    if (!isConnectGitRemoteInput(input)) {
      return fail("GIT_REMOTE_INVALID_INPUT", "GitHubリポジトリのURLを入力してください。");
    }

    return withActiveWorkspace(
      { code: "GIT_REMOTE_CONNECT_FAILED", message: "GitHubリポジトリを接続できませんでした。" },
      (workspacePath) => connectGitRemote(workspacePath, input)
    );
  });

  ipcMain.handle(pushGitBranchChannel, async (): Promise<RelicResult<GitRemoteSyncResult>> => {
    return withActiveWorkspace(
      { code: "GIT_PUSH_FAILED", message: "GitHubへ送信できませんでした。" },
      pushGitBranch
    );
  });

  ipcMain.handle(pullGitBranchChannel, async (): Promise<RelicResult<GitRemoteSyncResult>> => {
    return withActiveWorkspace(
      { code: "GIT_PULL_FAILED", message: "GitHubから取得できませんでした。" },
      pullGitBranch
    );
  });

  ipcMain.handle(pushGitTagChannel, async (_event, input: PushGitTagInput): Promise<RelicResult<GitRemoteSyncResult>> => {
    if (!isPushGitTagInput(input)) {
      return fail("GIT_TAG_INVALID_INPUT", "送信するタグを選択してください。");
    }

    return withActiveWorkspace(
      { code: "GIT_TAG_PUSH_FAILED", message: "GitタグをGitHubへ送信できませんでした。" },
      (workspacePath) => pushGitTag(workspacePath, input)
    );
  });

  ipcMain.handle(switchGitBranchChannel, async (_event, input: SwitchGitBranchInput): Promise<RelicResult<GitBranchSummary[]>> => {
    if (!isSwitchGitBranchInput(input)) {
      return fail("GIT_BRANCH_INVALID_INPUT", "切り替えるブランチを選択してください。");
    }

    return withActiveWorkspace(
      { code: "GIT_BRANCH_SWITCH_FAILED", message: "ブランチを切り替えできませんでした。" },
      (workspacePath) => switchGitBranch(workspacePath, input)
    );
  });

  ipcMain.handle(getGitSyncPreviewChannel, async (): Promise<RelicResult<GitSyncPreview>> => {
    return withActiveWorkspace(
      { code: "GIT_SYNC_PREVIEW_FAILED", message: "同期プレビューを取得できませんでした。" },
      readGitSyncPreview
    );
  });

  ipcMain.handle(getGitConflictsChannel, async (): Promise<RelicResult<GitConflict[]>> => {
    return withActiveWorkspace(
      { code: "GIT_CONFLICTS_FAILED", message: "コンフリクト情報を取得できませんでした。" },
      readGitConflicts
    );
  });

  ipcMain.handle(
    resolveGitConflictChannel,
    async (_event, input: ResolveGitConflictInput): Promise<RelicResult<GitConflict[]>> => {
      if (!isResolveGitConflictInput(input)) {
        return fail("GIT_CONFLICT_INVALID_INPUT", "解決するファイルと方法を指定してください。");
      }

      return withActiveWorkspace(
        { code: "GIT_CONFLICT_RESOLVE_FAILED", message: "コンフリクトを解決できませんでした。" },
        (workspacePath) => resolveGitConflict(workspacePath, input)
      );
    }
  );
}

function isCreateGitCommitInput(input: unknown): input is CreateGitCommitInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "message" in input &&
    typeof (input as { message?: unknown }).message === "string"
  );
}

async function readGitHubAuthor(): Promise<RelicResult<{ authorEmail: string; authorName: string }>> {
  try {
    const auth = await readGitHubAuthFromKeychain();

    if (!auth) {
      return fail("GITHUB_AUTH_REQUIRED", "コミットするにはGitHub接続が必要です。");
    }

    return ok({
      authorEmail: `${auth.login}@users.noreply.github.com`,
      authorName: auth.login
    });
  } catch (error) {
    return fail(
      "GITHUB_AUTH_STATUS_FAILED",
      "GitHub接続状態を確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function withGitHubTagger(input: CreateGitTagInput): Promise<RelicResult<CreateGitTagInput>> {
  if (!input.message?.trim()) {
    return ok(input);
  }

  const author = await readGitHubAuthor();

  if (!author.ok) {
    return author;
  }

  return ok({
    ...input,
    taggerEmail: author.value.authorEmail,
    taggerName: author.value.authorName
  });
}

function isCreateGitBranchInput(input: unknown): input is CreateGitBranchInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}

function isSwitchGitBranchInput(input: unknown): input is SwitchGitBranchInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string" &&
    (!("allowDirty" in input) ||
      typeof (input as { allowDirty?: unknown }).allowDirty === "boolean")
  );
}

function isCreateGitTagInput(input: unknown): input is CreateGitTagInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string" &&
    (!("hash" in input) || typeof (input as { hash?: unknown }).hash === "string") &&
    (!("message" in input) || typeof (input as { message?: unknown }).message === "string") &&
    (!("taggerName" in input) || typeof (input as { taggerName?: unknown }).taggerName === "string") &&
    (!("taggerEmail" in input) || typeof (input as { taggerEmail?: unknown }).taggerEmail === "string")
  );
}

function isDeleteGitTagInput(input: unknown): input is DeleteGitTagInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}

function isConnectGitRemoteInput(input: unknown): input is ConnectGitRemoteInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "url" in input &&
    typeof (input as { url?: unknown }).url === "string"
  );
}

function isPushGitTagInput(input: unknown): input is PushGitTagInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}

function isResolveGitConflictInput(input: unknown): input is ResolveGitConflictInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "resolution" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    ((input as { resolution?: unknown }).resolution === "ours" ||
      (input as { resolution?: unknown }).resolution === "theirs")
  );
}
