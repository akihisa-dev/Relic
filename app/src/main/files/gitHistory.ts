import fs from "node:fs";

import git from "isomorphic-git";

import type {
  GitCommitDiff,
  GitCommitDiffEntry,
  GitCommitSummary
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitStatus } from "./gitStatus";

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

    const hasHead = await hasCommitHistory(workspacePath);

    if (!hasHead) {
      return ok([]);
    }

    const commits = await git.log({
      depth,
      dir: workspacePath,
      fs
    });

    return ok(commits.map(toCommitSummary));
  } catch (error) {
    return fail(
      "GIT_HISTORY_FAILED",
      "コミット履歴を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function hasCommitHistory(workspacePath: string): Promise<boolean> {
  try {
    await git.resolveRef({
      dir: workspacePath,
      fs,
      ref: "HEAD"
    });

    return true;
  } catch {
    return false;
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

export function toCommitSummary(entry: Awaited<ReturnType<typeof git.log>>[number]): GitCommitSummary {
  return {
    author: entry.commit.author.name,
    changedFiles: [],
    date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
    hash: entry.oid,
    message: entry.commit.message.trim()
  };
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
