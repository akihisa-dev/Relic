import fs from "node:fs";
import path from "node:path";

import git from "isomorphic-git";

import type {
  CreateGitCommitInput,
  GitCommitSummary,
  GitStatus,
  GitWorkingChange
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";

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

    return ok(
      matrix
        .map(([filePath, head, workdir, stage]) => {
          const statusValue = toWorkingChangeStatus(head, workdir, stage);

          if (!statusValue) {
            return null;
          }

          return { path: filePath, status: statusValue } satisfies GitWorkingChange;
        })
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

  if (head === 1 && workdir === 2 && stage !== 2) {
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
