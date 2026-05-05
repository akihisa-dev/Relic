import fs from "node:fs";
import path from "node:path";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import type {
  ConnectGitRemoteInput,
  CreateGitBranchInput,
  CreateGitCommitInput,
  CreateGitTagInput,
  DeleteGitTagInput,
  GitBranchSummary,
  GitCommitDiff,
  GitCommitDiffEntry,
  GitConflict,
  GitRemoteSummary,
  GitRemoteSyncResult,
  GitSyncPreview,
  GitTagSummary,
  PushGitTagInput,
  ResolveGitConflictInput,
  SwitchGitBranchInput,
  GitCommitSummary,
  GitStatus,
  GitWorkingChange
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitHubAuthFromKeychain } from "../github/keychain";

export async function readGitStatus(workspacePath: string): Promise<RelicResult<GitStatus>> {
  try {
    const gitDirPath = path.join(workspacePath, ".git");

    if (!(await gitDirectoryExists(gitDirPath))) {
      return ok({
        currentBranch: null,
        initialized: false
      });
    }

    const currentBranch =
      (await git.currentBranch({
        dir: workspacePath,
        fs,
        fullname: false
      })) ?? null;

    return ok({
      currentBranch,
      initialized: true
    });
  } catch (error) {
    return fail(
      "GIT_STATUS_FAILED",
      "Git状態を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function initializeGitRepository(workspacePath: string): Promise<RelicResult<GitStatus>> {
  try {
    const currentStatus = await readGitStatus(workspacePath);

    if (!currentStatus.ok) {
      return currentStatus;
    }

    if (currentStatus.value.initialized) {
      return fail("GIT_ALREADY_INITIALIZED", "このワークスペースはすでにGit管理されています。");
    }

    await git.init({
      defaultBranch: "main",
      dir: workspacePath,
      fs
    });

    return readGitStatus(workspacePath);
  } catch (error) {
    return fail(
      "GIT_INIT_FAILED",
      "Gitリポジトリを初期化できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitWorkingChanges(
  workspacePath: string
): Promise<RelicResult<GitWorkingChange[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const matrix = await git.statusMatrix({
      dir: workspacePath,
      fs
    });

    const changes = await Promise.all(
      matrix.map(async ([filePath, head, workdir, stage]) => {
        const statusValue = toWorkingChangeStatus(head, workdir, stage);

        if (statusValue) {
          return { path: filePath, status: statusValue } satisfies GitWorkingChange;
        }

        if (
          head === 1 &&
          workdir === 1 &&
          stage === 1 &&
          (await trackedFileDiffersFromHead(workspacePath, filePath))
        ) {
          return { path: filePath, status: "modified" } satisfies GitWorkingChange;
        }

        return null;
      })
    );

    return ok(
      changes
        .filter((change): change is GitWorkingChange => change !== null)
        .sort((a, b) => a.path.localeCompare(b.path, "ja"))
    );
  } catch (error) {
    return fail(
      "GIT_WORKING_CHANGES_FAILED",
      "変更一覧を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitBranches(
  workspacePath: string
): Promise<RelicResult<GitBranchSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const [branchNames, currentBranch] = await Promise.all([
      git.listBranches({
        dir: workspacePath,
        fs
      }),
      git.currentBranch({
        dir: workspacePath,
        fs,
        fullname: false
      })
    ]);

    const uniqueBranchNames = Array.from(
      new Set(currentBranch ? [...branchNames, currentBranch] : branchNames)
    );

    return ok(
      uniqueBranchNames
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((name) => ({
          isCurrent: name === currentBranch,
          name
        }))
    );
  } catch (error) {
    return fail(
      "GIT_BRANCHES_FAILED",
      "ブランチ一覧を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitRemotes(
  workspacePath: string
): Promise<RelicResult<GitRemoteSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const remotes = await git.listRemotes({
      dir: workspacePath,
      fs
    });

    return ok(
      remotes
        .map((remote) => ({
          isOrigin: remote.remote === "origin",
          name: remote.remote,
          url: remote.url
        }))
        .sort((a, b) => {
          if (a.isOrigin !== b.isOrigin) return a.isOrigin ? -1 : 1;
          return a.name.localeCompare(b.name, "ja");
        })
    );
  } catch (error) {
    return fail(
      "GIT_REMOTES_FAILED",
      "GitHubリポジトリ接続を確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function connectGitRemote(
  workspacePath: string,
  input: ConnectGitRemoteInput
): Promise<RelicResult<GitRemoteSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const url = normalizeGitHubRemoteUrl(input.url);

    if (!url.ok) {
      return url;
    }

    await git.addRemote({
      dir: workspacePath,
      force: true,
      fs,
      remote: "origin",
      url: url.value
    });

    return readGitRemotes(workspacePath);
  } catch (error) {
    return fail(
      "GIT_REMOTE_CONNECT_FAILED",
      "GitHubリポジトリを接続できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function pushGitBranch(
  workspacePath: string
): Promise<RelicResult<GitRemoteSyncResult>> {
  try {
    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    const result = await git.push({
      dir: workspacePath,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      remote: "origin",
      ref: ready.value.currentBranch,
      remoteRef: ready.value.currentBranch
    });

    return ok({
      errors: pushResultErrors(result),
      message: "現在のブランチをGitHubへ送信しました。",
      updatedRefs: pushResultUpdatedRefs(result)
    });
  } catch (error) {
    return fail(
      "GIT_PUSH_FAILED",
      "GitHubへ送信できませんでした。接続状態と権限を確認してから再試行してください。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function pullGitBranch(
  workspacePath: string
): Promise<RelicResult<GitRemoteSyncResult>> {
  try {
    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    await git.pull({
      author: {
        email: `${ready.value.login}@users.noreply.github.com`,
        name: ready.value.login
      },
      dir: workspacePath,
      fastForwardOnly: true,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      ref: ready.value.currentBranch,
      remote: "origin",
      remoteRef: ready.value.currentBranch,
      singleBranch: true
    });

    return ok({
      errors: [],
      message: "GitHubから現在のブランチを取得しました。",
      updatedRefs: [ready.value.currentBranch]
    });
  } catch (error) {
    return fail(
      "GIT_PULL_FAILED",
      "GitHubから取得できませんでした。競合がある場合は手動で確認してください。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function pushGitTag(
  workspacePath: string,
  input: PushGitTagInput
): Promise<RelicResult<GitRemoteSyncResult>> {
  try {
    const tagName = normalizeTagName(input.name);

    if (!tagName.ok) {
      return tagName;
    }

    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    const result = await git.push({
      dir: workspacePath,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      ref: `refs/tags/${tagName.value}`,
      remote: "origin",
      remoteRef: `refs/tags/${tagName.value}`
    });

    return ok({
      errors: pushResultErrors(result),
      message: `タグ ${tagName.value} をGitHubへ送信しました。`,
      updatedRefs: pushResultUpdatedRefs(result)
    });
  } catch (error) {
    return fail(
      "GIT_TAG_PUSH_FAILED",
      "GitタグをGitHubへ送信できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitTags(
  workspacePath: string
): Promise<RelicResult<GitTagSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const tagNames = await git.listTags({
      dir: workspacePath,
      fs
    });

    const tags = await Promise.all(tagNames.map((name) => readGitTagSummary(workspacePath, name)));

    return ok(
      tags
        .sort((a, b) => {
          if (a.date !== b.date) {
            return b.date.localeCompare(a.date);
          }

          return a.name.localeCompare(b.name, "ja");
        })
    );
  } catch (error) {
    return fail(
      "GIT_TAGS_FAILED",
      "Gitタグ一覧を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function createGitBranch(
  workspacePath: string,
  input: CreateGitBranchInput
): Promise<RelicResult<GitBranchSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const branchName = normalizeBranchName(input.name);

    if (!branchName.ok) {
      return branchName;
    }

    const hasCommits = await ensureBranchOperationsAvailable(workspacePath);

    if (!hasCommits.ok) {
      return hasCommits;
    }

    await git.branch({
      dir: workspacePath,
      fs,
      ref: branchName.value
    });

    return readGitBranches(workspacePath);
  } catch (error) {
    return fail(
      "GIT_BRANCH_CREATE_FAILED",
      "ブランチを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function switchGitBranch(
  workspacePath: string,
  input: SwitchGitBranchInput
): Promise<RelicResult<GitBranchSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const branchName = normalizeBranchName(input.name);

    if (!branchName.ok) {
      return branchName;
    }

    const hasCommits = await ensureBranchOperationsAvailable(workspacePath);

    if (!hasCommits.ok) {
      return hasCommits;
    }

    const workingChanges = await readGitWorkingChanges(workspacePath);

    if (!workingChanges.ok) {
      return workingChanges;
    }

    if (workingChanges.value.length > 0 && !input.allowDirty) {
      return fail(
        "GIT_BRANCH_SWITCH_DIRTY",
        "未コミット変更があります。切り替え前に確認してください。"
      );
    }

    await git.checkout({
      dir: workspacePath,
      fs,
      ref: branchName.value
    });

    return readGitBranches(workspacePath);
  } catch (error) {
    return fail(
      "GIT_BRANCH_SWITCH_FAILED",
      "ブランチを切り替えできませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function createGitTag(
  workspacePath: string,
  input: CreateGitTagInput
): Promise<RelicResult<GitTagSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const validated = validateTagInput(input);

    if (!validated.ok) {
      return validated;
    }

    const hasCommits = await ensureBranchOperationsAvailable(workspacePath);

    if (!hasCommits.ok) {
      return fail("GIT_TAG_REQUIRES_COMMIT", "タグ作成は最初のコミット後に使えます。");
    }

    if (validated.value.message) {
      await git.annotatedTag({
        dir: workspacePath,
        fs,
        message: validated.value.message,
        object: validated.value.hash,
        ref: validated.value.name,
        tagger: {
          email: validated.value.taggerEmail,
          name: validated.value.taggerName
        }
      });
    } else {
      await git.tag({
        dir: workspacePath,
        fs,
        object: validated.value.hash,
        ref: validated.value.name
      });
    }

    return readGitTags(workspacePath);
  } catch (error) {
    return fail(
      "GIT_TAG_CREATE_FAILED",
      "Gitタグを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function deleteGitTag(
  workspacePath: string,
  input: DeleteGitTagInput
): Promise<RelicResult<GitTagSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const tagName = normalizeTagName(input.name);

    if (!tagName.ok) {
      return tagName;
    }

    await git.deleteTag({
      dir: workspacePath,
      fs,
      ref: tagName.value
    });

    return readGitTags(workspacePath);
  } catch (error) {
    return fail(
      "GIT_TAG_DELETE_FAILED",
      "Gitタグを削除できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function createGitCommit(
  workspacePath: string,
  input: CreateGitCommitInput
): Promise<RelicResult<GitCommitSummary>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const validated = validateCommitInput(input);

    if (!validated.ok) {
      return validated;
    }

    const workingChanges = await readGitWorkingChanges(workspacePath);

    if (!workingChanges.ok) {
      return workingChanges;
    }

    if (workingChanges.value.length === 0) {
      return fail("GIT_NO_CHANGES", "コミットする変更がありません。");
    }

    for (const change of workingChanges.value) {
      if (change.status === "deleted") {
        await git.remove({
          dir: workspacePath,
          filepath: change.path,
          fs
        });
      } else {
        await git.add({
          dir: workspacePath,
          filepath: change.path,
          fs
        });
      }
    }

    const oid = await git.commit({
      author: {
        email: validated.value.authorEmail,
        name: validated.value.authorName
      },
      dir: workspacePath,
      fs,
      message: validated.value.message
    });

    const history = await readGitCommitHistory(workspacePath, 1);

    if (!history.ok || history.value.length === 0) {
      return fail("GIT_COMMIT_FAILED", "コミットは作成されましたが履歴を取得できませんでした。");
    }

    const latestCommit = history.value[0];

    if (latestCommit.hash !== oid) {
      return ok({
        ...latestCommit,
        changedFiles: workingChanges.value.map((change) => change.path)
      });
    }

    return ok({
      ...latestCommit,
      changedFiles: workingChanges.value.map((change) => change.path)
    });
  } catch (error) {
    return fail(
      "GIT_COMMIT_FAILED",
      "コミットを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitCommitHistory(
  workspacePath: string,
  depth = 20
): Promise<RelicResult<GitCommitSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const commits = await git.log({
      depth,
      dir: workspacePath,
      fs
    });

    return ok(
      commits.map((entry) => ({
        author: entry.commit.author.name,
        changedFiles: [],
        date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
        hash: entry.oid,
        message: entry.commit.message.trim()
      }))
    );
  } catch (error) {
    return fail(
      "GIT_HISTORY_FAILED",
      "コミット履歴を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitCommitDiff(
  workspacePath: string,
  commitHash: string
): Promise<RelicResult<GitCommitDiff>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const history = await readGitCommitHistory(workspacePath, 200);

    if (!history.ok) {
      return history;
    }

    const commitSummary = history.value.find((commit) => commit.hash === commitHash);

    if (!commitSummary) {
      return fail("GIT_COMMIT_NOT_FOUND", "指定したコミットが見つかりませんでした。");
    }

    const { commit } = await git.readCommit({
      dir: workspacePath,
      fs,
      oid: commitHash
    });
    const parentHash = commit.parent[0];

    const [beforeFiles, afterFiles] = await Promise.all([
      parentHash ? readCommitFiles(workspacePath, parentHash) : Promise.resolve(new Map<string, string>()),
      readCommitFiles(workspacePath, commitHash)
    ]);

    const entries = buildCommitDiffEntries(beforeFiles, afterFiles);

    return ok({
      commit: {
        ...commitSummary,
        changedFiles: entries.map((entry) => entry.path)
      },
      entries
    });
  } catch (error) {
    return fail(
      "GIT_COMMIT_DIFF_FAILED",
      "コミット差分を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function gitDirectoryExists(gitDirPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(gitDirPath);

    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}

function toWorkingChangeStatus(
  head: number,
  workdir: number,
  stage: number
): GitWorkingChange["status"] | null {
  if (head === 0 && workdir === 2 && stage === 0) {
    return "untracked";
  }

  if (head === 1 && workdir === 0) {
    return "deleted";
  }

  if (head === 0 && workdir === 2) {
    return "added";
  }

  if (head === 1 && workdir === 2) {
    return "modified";
  }

  return null;
}

function validateCommitInput(
  input: CreateGitCommitInput
): RelicResult<CreateGitCommitInput> {
  const message = input.message.trim();
  const authorName = input.authorName.trim();
  const authorEmail = input.authorEmail.trim();

  if (message === "") {
    return fail("GIT_COMMIT_INVALID_INPUT", "コミットメッセージを入力してください。");
  }

  if (authorName === "") {
    return fail("GIT_COMMIT_INVALID_INPUT", "作者名を入力してください。");
  }

  if (authorEmail === "" || !authorEmail.includes("@")) {
    return fail("GIT_COMMIT_INVALID_INPUT", "有効なメールアドレスを入力してください。");
  }

  return ok({
    authorEmail,
    authorName,
    message
  });
}

function normalizeBranchName(name: string): RelicResult<string> {
  const trimmed = name.trim();

  if (trimmed === "") {
    return fail("GIT_BRANCH_INVALID_INPUT", "ブランチ名を入力してください。");
  }

  if (trimmed.includes(" ") || trimmed.startsWith(".") || trimmed.endsWith(".") || trimmed.includes("..")) {
    return fail("GIT_BRANCH_INVALID_INPUT", "ブランチ名の形式が正しくありません。");
  }

  return ok(trimmed);
}

function normalizeTagName(name: string): RelicResult<string> {
  const trimmed = name.trim();

  if (trimmed === "") {
    return fail("GIT_TAG_INVALID_INPUT", "タグ名を入力してください。");
  }

  if (
    trimmed.includes(" ") ||
    trimmed.startsWith(".") ||
    trimmed.endsWith(".") ||
    trimmed.includes("..") ||
    trimmed.includes("^") ||
    trimmed.includes(":") ||
    trimmed.includes("~")
  ) {
    return fail("GIT_TAG_INVALID_INPUT", "タグ名の形式が正しくありません。");
  }

  return ok(trimmed);
}

function normalizeGitHubRemoteUrl(url: string): RelicResult<string> {
  const trimmed = url.trim();

  if (trimmed === "") {
    return fail("GIT_REMOTE_INVALID_INPUT", "GitHubリポジトリのURLを入力してください。");
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
      return fail("GIT_REMOTE_INVALID_INPUT", "GitHubのHTTPSリポジトリURLを入力してください。");
    }

    const segments = parsed.pathname.split("/").filter(Boolean);

    if (segments.length !== 2) {
      return fail("GIT_REMOTE_INVALID_INPUT", "URLの形式が正しくありません。");
    }

    const repositoryPath = segments.join("/");

    return ok(`https://github.com/${repositoryPath.endsWith(".git") ? repositoryPath : `${repositoryPath}.git`}`);
  } catch (error) {
    return fail(
      "GIT_REMOTE_INVALID_INPUT",
      "GitHubリポジトリURLを読み取れませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function ensureRemoteOperationReady(
  workspacePath: string
): Promise<RelicResult<{
  accessToken: string;
  currentBranch: string;
  login: string;
}>> {
  const status = await readGitStatus(workspacePath);

  if (!status.ok) {
    return status;
  }

  if (!status.value.initialized) {
    return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
  }

  if (!status.value.currentBranch) {
    return fail("GIT_BRANCH_NOT_SELECTED", "送受信するブランチを選択してください。");
  }

  const remotes = await readGitRemotes(workspacePath);

  if (!remotes.ok) {
    return remotes;
  }

  if (!remotes.value.some((remote) => remote.name === "origin")) {
    return fail("GIT_REMOTE_NOT_CONNECTED", "先にGitHubリポジトリを接続してください。");
  }

  const auth = await readGitHubAuthFromKeychain();

  if (!auth) {
    return fail("GITHUB_AUTH_REQUIRED", "先にGitHubアカウントを接続してください。");
  }

  return ok({
    accessToken: auth.accessToken,
    currentBranch: status.value.currentBranch,
    login: auth.login
  });
}

function toGitAuth(accessToken: string): { password: string; username: string } {
  return {
    password: accessToken,
    username: "x-access-token"
  };
}

function pushResultUpdatedRefs(result: Awaited<ReturnType<typeof git.push>>): string[] {
  return Object.entries(result.refs)
    .filter(([, status]) => status.ok)
    .map(([ref]) => ref);
}

function pushResultErrors(result: Awaited<ReturnType<typeof git.push>>): string[] {
  const refErrors = Object.entries(result.refs)
    .filter(([, status]) => !status.ok)
    .map(([ref, status]) => `${ref}: ${status.error}`);

  return result.error ? [result.error, ...refErrors] : refErrors;
}

function validateTagInput(
  input: CreateGitTagInput
): RelicResult<Required<Pick<CreateGitTagInput, "hash" | "name">> & Pick<CreateGitTagInput, "message"> & {
  taggerEmail: string;
  taggerName: string;
}> {
  const normalizedName = normalizeTagName(input.name);

  if (!normalizedName.ok) {
    return normalizedName;
  }

  const hash = input.hash?.trim() || "HEAD";
  const message = input.message?.trim() || "";
  const taggerName = input.taggerName?.trim() || "";
  const taggerEmail = input.taggerEmail?.trim() || "";

  if (message !== "") {
    if (taggerName === "") {
      return fail("GIT_TAG_INVALID_INPUT", "メモ付きタグには作者名が必要です。");
    }

    if (taggerEmail === "" || !taggerEmail.includes("@")) {
      return fail("GIT_TAG_INVALID_INPUT", "メモ付きタグには有効なメールアドレスが必要です。");
    }
  }

  return ok({
    hash,
    message: message === "" ? undefined : message,
    name: normalizedName.value,
    taggerEmail,
    taggerName
  });
}

async function ensureBranchOperationsAvailable(workspacePath: string): Promise<RelicResult<void>> {
  try {
    await git.resolveRef({
      dir: workspacePath,
      fs,
      ref: "HEAD"
    });

    return ok(undefined);
  } catch (error) {
    return fail(
      "GIT_BRANCH_REQUIRES_COMMIT",
      "ブランチ操作は最初のコミット後に使えます。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function readGitTagSummary(workspacePath: string, name: string): Promise<GitTagSummary> {
  const oid = await git.resolveRef({
    dir: workspacePath,
    fs,
    ref: `refs/tags/${name}`
  });

  try {
    const tag = await git.readTag({
      dir: workspacePath,
      fs,
      oid
    });

    const targetCommit = await git.readCommit({
      dir: workspacePath,
      fs,
      oid: tag.tag.object
    });

    return {
      annotated: true,
      date: new Date(tag.tag.tagger.timestamp * 1000).toISOString(),
      message: tag.tag.message.trim() || null,
      name,
      targetHash: tag.tag.object,
      targetMessage: targetCommit.commit.message.trim() || null
    };
  } catch {
    const commit = await git.readCommit({
      dir: workspacePath,
      fs,
      oid
    });

    return {
      annotated: false,
      date: new Date(commit.commit.author.timestamp * 1000).toISOString(),
      message: null,
      name,
      targetHash: oid,
      targetMessage: commit.commit.message.trim() || null
    };
  }
}

async function trackedFileDiffersFromHead(workspacePath: string, filePath: string): Promise<boolean> {
  try {
    const [headBlob, worktreeBuffer] = await Promise.all([
      git.readBlob({
        dir: workspacePath,
        fs,
        filepath: filePath,
        oid: await git.resolveRef({
          dir: workspacePath,
          fs,
          ref: "HEAD"
        })
      }),
      fs.promises.readFile(path.join(workspacePath, filePath))
    ]);

    return !Buffer.from(headBlob.blob).equals(worktreeBuffer);
  } catch {
    return false;
  }
}

async function readCommitFiles(
  workspacePath: string,
  commitHash: string
): Promise<Map<string, string>> {
  const { commit } = await git.readCommit({
    dir: workspacePath,
    fs,
    oid: commitHash
  });

  const files = new Map<string, string>();

  await walkTreeFiles(workspacePath, commitHash, commit.tree, "", files);

  return files;
}

async function walkTreeFiles(
  workspacePath: string,
  commitHash: string,
  treeOid: string,
  prefix: string,
  files: Map<string, string>
): Promise<void> {
  const { tree } = await git.readTree({
    dir: workspacePath,
    fs,
    oid: treeOid
  });

  for (const entry of tree) {
    const filePath = prefix ? `${prefix}/${entry.path}` : entry.path;

    if (entry.type === "tree") {
      await walkTreeFiles(workspacePath, commitHash, entry.oid, filePath, files);
      continue;
    }

    if (entry.type !== "blob") {
      continue;
    }

    const { blob } = await git.readBlob({
      dir: workspacePath,
      filepath: filePath,
      fs,
      oid: commitHash
    });

    files.set(filePath, Buffer.from(blob).toString("utf8"));
  }
}

function buildCommitDiffEntries(
  beforeFiles: Map<string, string>,
  afterFiles: Map<string, string>
): GitCommitDiffEntry[] {
  return [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .flatMap((filePath) => {
      const before = beforeFiles.get(filePath);
      const after = afterFiles.get(filePath);

      if (before === after) {
        return [];
      }

      return [{
        after: after ?? "",
        before: before ?? "",
        path: filePath,
        status: before === undefined ? "added" : after === undefined ? "deleted" : "modified"
      } satisfies GitCommitDiffEntry];
    });
}

function toCommitSummary(entry: Awaited<ReturnType<typeof git.log>>[number]): GitCommitSummary {
  return {
    author: entry.commit.author.name,
    changedFiles: [],
    date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
    hash: entry.oid,
    message: entry.commit.message.trim()
  };
}

export async function cloneGitHubRepository(
  url: string,
  destinationPath: string
): Promise<RelicResult<void>> {
  try {
    const normalizedUrl = normalizeGitHubRemoteUrl(url);

    if (!normalizedUrl.ok) {
      return normalizedUrl;
    }

    const auth = await readGitHubAuthFromKeychain();

    if (!auth) {
      return fail("GITHUB_AUTH_REQUIRED", "先にGitHubアカウントを接続してください。");
    }

    await git.clone({
      dir: destinationPath,
      fs,
      http,
      onAuth: () => toGitAuth(auth.accessToken),
      singleBranch: true,
      url: normalizedUrl.value
    });

    return ok(undefined);
  } catch (error) {
    return fail(
      "GIT_CLONE_FAILED",
      "GitHubリポジトリをクローンできませんでした。URLとGitHub接続を確認してください。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function fetchGitRemote(workspacePath: string): Promise<RelicResult<void>> {
  try {
    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    await git.fetch({
      dir: workspacePath,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      ref: ready.value.currentBranch,
      remote: "origin",
      singleBranch: true
    });

    return ok(undefined);
  } catch (error) {
    return fail(
      "GIT_FETCH_FAILED",
      "GitHubから変更情報を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function readGitIncomingCommits(workspacePath: string): Promise<RelicResult<GitCommitSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized || !status.value.currentBranch) {
      return ok([]);
    }

    const remoteRef = `refs/remotes/origin/${status.value.currentBranch}`;

    let remoteOid: string;

    try {
      remoteOid = await git.resolveRef({ dir: workspacePath, fs, ref: remoteRef });
    } catch {
      return ok([]);
    }

    let localOid: string;

    try {
      localOid = await git.resolveRef({ dir: workspacePath, fs, ref: "HEAD" });
    } catch {
      const commits = await git.log({ depth: 20, dir: workspacePath, fs, ref: remoteOid });

      return ok(commits.map(toCommitSummary));
    }

    if (localOid === remoteOid) {
      return ok([]);
    }

    const [localHistory, remoteHistory] = await Promise.all([
      git.log({ depth: 100, dir: workspacePath, fs, ref: localOid }),
      git.log({ depth: 50, dir: workspacePath, fs, ref: remoteOid })
    ]);

    const localOids = new Set(localHistory.map((c) => c.oid));

    return ok(remoteHistory.filter((c) => !localOids.has(c.oid)).map(toCommitSummary));
  } catch (error) {
    return fail(
      "GIT_INCOMING_COMMITS_FAILED",
      "GitHubの受信予定の変更を確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitSyncPreview(workspacePath: string): Promise<RelicResult<GitSyncPreview>> {
  const fetchResult = await fetchGitRemote(workspacePath);

  if (!fetchResult.ok) {
    return fetchResult;
  }

  const [workingChanges, incomingCommits] = await Promise.all([
    readGitWorkingChanges(workspacePath),
    readGitIncomingCommits(workspacePath)
  ]);

  if (!workingChanges.ok) {
    return workingChanges;
  }

  if (!incomingCommits.ok) {
    return incomingCommits;
  }

  return ok({
    incomingCommits: incomingCommits.value,
    outgoingChanges: workingChanges.value
  });
}

const CONFLICT_START_RE = /^<<<<<<< /m;

function resolveConflictSide(content: string, side: "ours" | "theirs"): string {
  return content.replace(
    /<<<<<<< [^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]*\n?/g,
    (_match, ours: string, theirs: string) => side === "ours" ? ours : theirs
  );
}

export async function readGitConflicts(workspacePath: string): Promise<RelicResult<GitConflict[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const matrix = await git.statusMatrix({ dir: workspacePath, fs });
    const conflicts: GitConflict[] = [];

    for (const [filePath, head, workdir] of matrix) {
      if (head === 0 || workdir === 0) {
        continue;
      }

      const fullPath = path.join(workspacePath, filePath);

      try {
        const content = await fs.promises.readFile(fullPath, "utf8");

        if (!CONFLICT_START_RE.test(content)) {
          continue;
        }

        conflicts.push({
          ours: resolveConflictSide(content, "ours"),
          path: filePath,
          theirs: resolveConflictSide(content, "theirs")
        });
      } catch {
        // skip unreadable files
      }
    }

    return ok(conflicts);
  } catch (error) {
    return fail(
      "GIT_CONFLICTS_FAILED",
      "コンフリクトファイルを確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function resolveGitConflict(
  workspacePath: string,
  input: ResolveGitConflictInput
): Promise<RelicResult<GitConflict[]>> {
  try {
    const filePath = path.join(workspacePath, input.path);
    const content = await fs.promises.readFile(filePath, "utf8");
    const resolved = resolveConflictSide(content, input.resolution);
    await fs.promises.writeFile(filePath, resolved, "utf8");

    return readGitConflicts(workspacePath);
  } catch (error) {
    return fail(
      "GIT_CONFLICT_RESOLVE_FAILED",
      "コンフリクトを解決できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function autoCommitAndPush(
  workspacePath: string,
  login: string,
  accessToken: string
): Promise<RelicResult<GitRemoteSyncResult>> {
  const changes = await readGitWorkingChanges(workspacePath);

  if (!changes.ok) {
    return changes;
  }

  if (changes.value.length > 0) {
    const now = new Date().toLocaleString("ja-JP", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const commitResult = await createGitCommit(workspacePath, {
      authorEmail: `${login}@users.noreply.github.com`,
      authorName: login,
      message: `Update notes: ${now}`
    });

    if (!commitResult.ok) {
      return commitResult;
    }
  }

  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok || !status.value.currentBranch) {
      return fail("GIT_PUSH_FAILED", "現在のブランチを確認できませんでした。");
    }

    const result = await git.push({
      dir: workspacePath,
      fs,
      http,
      onAuth: () => toGitAuth(accessToken),
      ref: status.value.currentBranch,
      remote: "origin",
      remoteRef: status.value.currentBranch
    });

    return ok({
      errors: pushResultErrors(result),
      message: "自動同期: GitHubへ送信しました。",
      updatedRefs: pushResultUpdatedRefs(result)
    });
  } catch (error) {
    return fail(
      "GIT_PUSH_FAILED",
      "自動同期: GitHubへ送信できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
