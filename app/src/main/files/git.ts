import fs from "node:fs";
import path from "node:path";

import git from "isomorphic-git";

import type {
  CreateGitBranchInput,
  CreateGitCommitInput,
  GitBranchSummary,
  GitCommitDiff,
  GitCommitDiffEntry,
  SwitchGitBranchInput,
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
