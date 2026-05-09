import fs from "node:fs";

import git from "isomorphic-git";

import type {
  ConnectGitRemoteInput,
  GitRemoteSummary
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitHubAuthFromKeychain } from "../github/keychain";
import { readGitStatus } from "./gitStatus";
import { normalizeGitHubRemoteUrl } from "./gitValidation";

export interface GitRemoteOperationReady {
  accessToken: string;
  currentBranch: string;
  login: string;
}

export async function readGitRemotes(
  workspacePath: string
): Promise<RelicResult<GitRemoteSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return ok([]);
    }

    const remotes = await git.listRemotes({
      dir: workspacePath,
      fs
    });

    return ok(
      remotes
        .map((remote) => ({
          isOrigin: remote.remote === "origin",
          name: remote.remote,
          url: remote.url
        }))
        .sort((a, b) => {
          if (a.isOrigin !== b.isOrigin) return a.isOrigin ? -1 : 1;
          return a.name.localeCompare(b.name, "ja");
        })
    );
  } catch (error) {
    return fail(
      "GIT_REMOTES_FAILED",
      "GitHubリポジトリ接続を確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function connectGitRemote(
  workspacePath: string,
  input: ConnectGitRemoteInput
): Promise<RelicResult<GitRemoteSummary[]>> {
  try {
    const status = await readGitStatus(workspacePath);

    if (!status.ok) {
      return status;
    }

    if (!status.value.initialized) {
      return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
    }

    const url = normalizeGitHubRemoteUrl(input.url);

    if (!url.ok) {
      return url;
    }

    await git.addRemote({
      dir: workspacePath,
      force: true,
      fs,
      remote: "origin",
      url: url.value
    });

    return readGitRemotes(workspacePath);
  } catch (error) {
    return fail(
      "GIT_REMOTE_CONNECT_FAILED",
      "GitHubリポジトリを接続できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function ensureRemoteOperationReady(
  workspacePath: string
): Promise<RelicResult<GitRemoteOperationReady>> {
  const status = await readGitStatus(workspacePath);

  if (!status.ok) {
    return status;
  }

  if (!status.value.initialized) {
    return fail("GIT_NOT_INITIALIZED", "先にGitを初期化してください。");
  }

  if (!status.value.currentBranch) {
    return fail("GIT_BRANCH_NOT_SELECTED", "送受信するブランチを選択してください。");
  }

  const remotes = await readGitRemotes(workspacePath);

  if (!remotes.ok) {
    return remotes;
  }

  if (!remotes.value.some((remote) => remote.name === "origin")) {
    return fail("GIT_REMOTE_NOT_CONNECTED", "先にGitHubリポジトリを接続してください。");
  }

  const auth = await readGitHubAuthFromKeychain();

  if (!auth) {
    return fail("GITHUB_AUTH_REQUIRED", "先にGitHubアカウントを接続してください。");
  }

  return ok({
    accessToken: auth.accessToken,
    currentBranch: status.value.currentBranch,
    login: auth.login
  });
}

export function pushResultUpdatedRefs(result: Awaited<ReturnType<typeof git.push>>): string[] {
  return Object.entries(result.refs)
    .filter(([, status]) => status.ok)
    .map(([ref]) => ref);
}

export function pushResultErrors(result: Awaited<ReturnType<typeof git.push>>): string[] {
  const refErrors = Object.entries(result.refs)
    .filter(([, status]) => !status.ok)
    .map(([ref, status]) => `${ref}: ${status.error}`);

  return result.error ? [result.error, ...refErrors] : refErrors;
}
