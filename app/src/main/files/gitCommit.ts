import fs from "node:fs";

import git from "isomorphic-git";

import type { GitCommitSummary } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitCommitHistory } from "./gitHistory";
import { readGitStatus } from "./gitStatus";
import { type GitCommitAuthorInput, validateCommitInput } from "./gitValidation";
import { readGitWorkingChanges } from "./gitWorkingTree";

export async function createGitCommit(
  workspacePath: string,
  input: GitCommitAuthorInput
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
