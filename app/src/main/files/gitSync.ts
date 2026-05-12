import fs from "node:fs";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import type {
  GitCommitSummary,
  GitRemoteSyncResult,
  GitSyncPreview
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { toCommitSummary } from "./gitHistory";
import {
  ensureRemoteOperationReady,
  pushResultErrors,
  pushResultUpdatedRefs
} from "./gitRemote";
import { readGitStatus } from "./gitStatus";
import { toGitAuth } from "./gitValidation";
import { readGitWorkingChanges } from "./gitWorkingTree";

export async function pushGitBranch(
  workspacePath: string
): Promise<RelicResult<GitRemoteSyncResult>> {
  try {
    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    const result = await git.push({
      dir: workspacePath,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      remote: "origin",
      ref: ready.value.currentBranch,
      remoteRef: ready.value.currentBranch
    });

    return ok({
      errors: pushResultErrors(result),
      message: "GitHubへ送信しました。",
      updatedRefs: pushResultUpdatedRefs(result)
    });
  } catch (error) {
    return fail(
      "GIT_PUSH_FAILED",
      "GitHubへ送信できませんでした。接続状態と権限を確認してから再試行してください。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function pullGitBranch(
  workspacePath: string
): Promise<RelicResult<GitRemoteSyncResult>> {
  try {
    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    const workingChanges = await readGitWorkingChanges(workspacePath);

    if (!workingChanges.ok) {
      return workingChanges;
    }

    if (workingChanges.value.length > 0) {
      return fail(
        "GIT_PULL_DIRTY_WORKTREE",
        "未コミット変更があります。Pullの前にコミットするか、変更内容を確認してください。"
      );
    }

    await git.pull({
      author: {
        email: `${ready.value.login}@users.noreply.github.com`,
        name: ready.value.login
      },
      dir: workspacePath,
      fastForwardOnly: true,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      ref: ready.value.currentBranch,
      remote: "origin",
      remoteRef: ready.value.currentBranch,
      singleBranch: true
    });

    return ok({
      errors: [],
      message: "GitHubから取得しました。",
      updatedRefs: [ready.value.currentBranch]
    });
  } catch (error) {
    return fail(
      "GIT_PULL_FAILED",
      "GitHubから取得できませんでした。競合がある場合は手動で確認してください。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function fetchGitRemote(workspacePath: string): Promise<RelicResult<void>> {
  try {
    const ready = await ensureRemoteOperationReady(workspacePath);

    if (!ready.ok) {
      return ready;
    }

    await git.fetch({
      dir: workspacePath,
      fs,
      http,
      onAuth: () => toGitAuth(ready.value.accessToken),
      ref: ready.value.currentBranch,
      remote: "origin",
      singleBranch: true
    });

    return ok(undefined);
  } catch (error) {
    return fail(
      "GIT_FETCH_FAILED",
      "GitHubから変更情報を取得できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function readGitSyncPreview(workspacePath: string): Promise<RelicResult<GitSyncPreview>> {
  const ready = await ensureRemoteOperationReady(workspacePath);

  if (!ready.ok) {
    return ready;
  }

  const fetchResult = await fetchGitRemote(workspacePath);

  if (!fetchResult.ok) {
    return fetchResult;
  }

  const [workingChanges, incomingCommits] = await Promise.all([
    readGitWorkingChanges(workspacePath),
    readGitIncomingCommits(workspacePath)
  ]);

  if (!workingChanges.ok) {
    return workingChanges;
  }

  if (!incomingCommits.ok) {
    return incomingCommits;
  }

  return ok({
    branch: ready.value.currentBranch,
    incomingCommits: incomingCommits.value,
    outgoingChanges: workingChanges.value,
    remoteName: "origin",
    remoteUrl: ready.value.remoteUrl,
    upstream: `origin/${ready.value.currentBranch}`
  });
}

async function readGitIncomingCommits(workspacePath: string): Promise<RelicResult<GitCommitSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized || !status.value.currentBranch) {
      return ok([]);
    }

    const remoteRef = `refs/remotes/origin/${status.value.currentBranch}`;

    let remoteOid: string;

    try {
      remoteOid = await git.resolveRef({ dir: workspacePath, fs, ref: remoteRef });
    } catch {
      return ok([]);
    }

    let localOid: string;

    try {
      localOid = await git.resolveRef({ dir: workspacePath, fs, ref: "HEAD" });
    } catch {
      const commits = await git.log({ depth: 20, dir: workspacePath, fs, ref: remoteOid });

      return ok(commits.map(toCommitSummary));
    }

    if (localOid === remoteOid) {
      return ok([]);
    }

    const [localHistory, remoteHistory] = await Promise.all([
      git.log({ depth: 100, dir: workspacePath, fs, ref: localOid }),
      git.log({ depth: 50, dir: workspacePath, fs, ref: remoteOid })
    ]);

    const localOids = new Set(localHistory.map((c) => c.oid));

    return ok(remoteHistory.filter((c) => !localOids.has(c.oid)).map(toCommitSummary));
  } catch (error) {
    return fail(
      "GIT_INCOMING_COMMITS_FAILED",
      "GitHubの受信予定の変更を確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
