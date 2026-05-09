import fs from "node:fs";
import path from "node:path";

import git from "isomorphic-git";

import type { GitWorkingChange } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitStatus } from "./gitStatus";

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
