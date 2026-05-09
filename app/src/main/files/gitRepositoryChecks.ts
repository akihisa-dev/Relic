import fs from "node:fs";

import git from "isomorphic-git";

import { fail, ok, type RelicResult } from "../../shared/result";

export async function ensureBranchOperationsAvailable(workspacePath: string): Promise<RelicResult<void>> {
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
