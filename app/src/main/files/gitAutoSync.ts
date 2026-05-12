import fs from "node:fs";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import type { GitRemoteSyncResult } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createGitCommit } from "./gitCommit";
import { pushResultErrors, pushResultUpdatedRefs } from "./gitRemote";
import { readGitStatus } from "./gitStatus";
import { toGitAuth } from "./gitValidation";
import { readGitWorkingChanges } from "./gitWorkingTree";

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
      return fail("GIT_PUSH_FAILED", "送信する履歴を確認できませんでした。");
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
