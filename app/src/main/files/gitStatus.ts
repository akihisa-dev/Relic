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

async function gitDirectoryExists(gitDirPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(gitDirPath);

    return stats.isDirectory() || stats.isFile();
  } catch {
    return false;
  }
}
