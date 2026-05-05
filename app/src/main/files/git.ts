import fs from "node:fs";
import path from "node:path";

import git from "isomorphic-git";

import type { GitStatus } from "../../shared/ipc";
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

async function gitDirectoryExists(gitDirPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(gitDirPath);

    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}
