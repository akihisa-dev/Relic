import fs from "node:fs";

import git from "isomorphic-git";

import type { GitStatus } from "../../shared/ipc";
import { fail, type RelicResult } from "../../shared/result";
import { readGitStatus } from "./gitStatus";

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
