import { app, ipcMain } from "electron";

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
import { readAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";

export function registerGitWorkspaceHandlers(): void {
  ipcMain.handle(getGitStatusChannel, async (): Promise<RelicResult<GitStatus>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitStatus(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_STATUS_FAILED",
        "Git状態を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitTagsChannel, async (): Promise<RelicResult<GitTagSummary[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitTags(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_TAGS_FAILED",
        "Gitタグ一覧を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitBranchesChannel, async (): Promise<RelicResult<GitBranchSummary[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitBranches(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_BRANCHES_FAILED",
        "ブランチ一覧を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitRemotesChannel, async (): Promise<RelicResult<GitRemoteSummary[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitRemotes(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_REMOTES_FAILED",
        "GitHubリポジトリ接続を確認できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitWorkingChangesChannel, async (): Promise<RelicResult<GitWorkingChange[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitWorkingChanges(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_WORKING_CHANGES_FAILED",
        "変更一覧を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitCommitHistoryChannel, async (): Promise<RelicResult<GitCommitSummary[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitCommitHistory(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_HISTORY_FAILED",
        "コミット履歴を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitCommitDiffChannel, async (_event, hash: string): Promise<RelicResult<GitCommitDiff>> => {
    try {
      if (typeof hash !== "string" || hash.trim() === "") {
        return fail("GIT_COMMIT_NOT_FOUND", "表示するコミットを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitCommitDiff(state.activeWorkspace.path, hash);
    } catch (error) {
      return fail(
        "GIT_COMMIT_DIFF_FAILED",
        "コミット差分を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(initializeGitRepositoryChannel, async (): Promise<RelicResult<GitStatus>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return initializeGitRepository(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_INIT_FAILED",
        "Gitリポジトリを初期化できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(createGitCommitChannel, async (_event, input: CreateGitCommitInput): Promise<RelicResult<GitCommitSummary>> => {
    try {
      if (!isCreateGitCommitInput(input)) {
        return fail("GIT_COMMIT_INVALID_INPUT", "コミットに必要な情報を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return createGitCommit(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_COMMIT_FAILED",
        "コミットを作成できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(createGitBranchChannel, async (_event, input: CreateGitBranchInput): Promise<RelicResult<GitBranchSummary[]>> => {
    try {
      if (!isCreateGitBranchInput(input)) {
        return fail("GIT_BRANCH_INVALID_INPUT", "ブランチ名を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return createGitBranch(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_BRANCH_CREATE_FAILED",
        "ブランチを作成できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(createGitTagChannel, async (_event, input: CreateGitTagInput): Promise<RelicResult<GitTagSummary[]>> => {
    try {
      if (!isCreateGitTagInput(input)) {
        return fail("GIT_TAG_INVALID_INPUT", "タグ名を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return createGitTag(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_TAG_CREATE_FAILED",
        "Gitタグを作成できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(deleteGitTagChannel, async (_event, input: DeleteGitTagInput): Promise<RelicResult<GitTagSummary[]>> => {
    try {
      if (!isDeleteGitTagInput(input)) {
        return fail("GIT_TAG_INVALID_INPUT", "削除するタグを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return deleteGitTag(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_TAG_DELETE_FAILED",
        "Gitタグを削除できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(connectGitRemoteChannel, async (_event, input: ConnectGitRemoteInput): Promise<RelicResult<GitRemoteSummary[]>> => {
    try {
      if (!isConnectGitRemoteInput(input)) {
        return fail("GIT_REMOTE_INVALID_INPUT", "GitHubリポジトリのURLを入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return connectGitRemote(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_REMOTE_CONNECT_FAILED",
        "GitHubリポジトリを接続できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(pushGitBranchChannel, async (): Promise<RelicResult<GitRemoteSyncResult>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return pushGitBranch(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_PUSH_FAILED",
        "GitHubへ送信できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(pullGitBranchChannel, async (): Promise<RelicResult<GitRemoteSyncResult>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return pullGitBranch(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_PULL_FAILED",
        "GitHubから取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(pushGitTagChannel, async (_event, input: PushGitTagInput): Promise<RelicResult<GitRemoteSyncResult>> => {
    try {
      if (!isPushGitTagInput(input)) {
        return fail("GIT_TAG_INVALID_INPUT", "送信するタグを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return pushGitTag(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_TAG_PUSH_FAILED",
        "GitタグをGitHubへ送信できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(switchGitBranchChannel, async (_event, input: SwitchGitBranchInput): Promise<RelicResult<GitBranchSummary[]>> => {
    try {
      if (!isSwitchGitBranchInput(input)) {
        return fail("GIT_BRANCH_INVALID_INPUT", "切り替えるブランチを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return switchGitBranch(state.activeWorkspace.path, input);
    } catch (error) {
      return fail(
        "GIT_BRANCH_SWITCH_FAILED",
        "ブランチを切り替えできませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitSyncPreviewChannel, async (): Promise<RelicResult<GitSyncPreview>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitSyncPreview(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_SYNC_PREVIEW_FAILED",
        "同期プレビューを取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(getGitConflictsChannel, async (): Promise<RelicResult<GitConflict[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readGitConflicts(state.activeWorkspace.path);
    } catch (error) {
      return fail(
        "GIT_CONFLICTS_FAILED",
        "コンフリクト情報を取得できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    resolveGitConflictChannel,
    async (_event, input: ResolveGitConflictInput): Promise<RelicResult<GitConflict[]>> => {
      try {
        if (!isResolveGitConflictInput(input)) {
          return fail("GIT_CONFLICT_INVALID_INPUT", "解決するファイルと方法を指定してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        return resolveGitConflict(state.activeWorkspace.path, input);
      } catch (error) {
        return fail(
          "GIT_CONFLICT_RESOLVE_FAILED",
          "コンフリクトを解決できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}

function isCreateGitCommitInput(input: unknown): input is CreateGitCommitInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "authorEmail" in input &&
    "authorName" in input &&
    "message" in input &&
    typeof (input as { authorEmail?: unknown }).authorEmail === "string" &&
    typeof (input as { authorName?: unknown }).authorName === "string" &&
    typeof (input as { message?: unknown }).message === "string"
  );
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
