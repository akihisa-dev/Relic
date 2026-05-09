import fs from "node:fs";

import git from "isomorphic-git";

import type {
  CreateGitBranchInput,
  GitBranchSummary,
  SwitchGitBranchInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { ensureBranchOperationsAvailable } from "./gitRepositoryChecks";
import { readGitStatus } from "./gitStatus";
import { normalizeBranchName } from "./gitValidation";
import { readGitWorkingChanges } from "./gitWorkingTree";

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

    const [branchNames, currentBranch, originBranchNames] = await Promise.all([
      git.listBranches({
        dir: workspacePath,
        fs
      }),
      git.currentBranch({
        dir: workspacePath,
        fs,
        fullname: false
      }),
      listOriginBranches(workspacePath)
    ]);

    const uniqueBranchNames = Array.from(
      new Set(currentBranch ? [...branchNames, currentBranch] : branchNames)
    );

    return ok(
      uniqueBranchNames
        .sort((a, b) => a.localeCompare(b, "ja"))
        .map((name) => ({
          isCurrent: name === currentBranch,
          name,
          upstream: originBranchNames.has(name) ? `origin/${name}` : null
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

async function listOriginBranches(workspacePath: string): Promise<Set<string>> {
  try {
    const branchNames = await git.listBranches({
      dir: workspacePath,
      fs,
      remote: "origin"
    });

    return new Set(branchNames);
  } catch {
    return new Set();
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
