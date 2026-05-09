import fs from "node:fs";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

import { fail, ok, type RelicResult } from "../../shared/result";
import { readGitHubAuthFromKeychain } from "../github/keychain";
import { normalizeGitHubRemoteUrl, toGitAuth } from "./gitValidation";

export async function cloneGitHubRepository(
  url: string,
  destinationPath: string
): Promise<RelicResult<void>> {
  try {
    const normalizedUrl = normalizeGitHubRemoteUrl(url);

    if (!normalizedUrl.ok) {
      return normalizedUrl;
    }

    const auth = await readGitHubAuthFromKeychain();

    if (!auth) {
      return fail("GITHUB_AUTH_REQUIRED", "先にGitHubアカウントを接続してください。");
    }

    await git.clone({
      dir: destinationPath,
      fs,
      http,
      onAuth: () => toGitAuth(auth.accessToken),
      singleBranch: true,
      url: normalizedUrl.value
    });

    return ok(undefined);
  } catch (error) {
    return fail(
      "GIT_CLONE_FAILED",
      "GitHubリポジトリをクローンできませんでした。URLとGitHub接続を確認してください。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
