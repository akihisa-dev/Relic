import type { CreateGitCommitInput } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";

export interface GitCommitAuthorInput extends CreateGitCommitInput {
  authorEmail: string;
  authorName: string;
}

export function validateCommitInput(
  input: GitCommitAuthorInput
): RelicResult<GitCommitAuthorInput> {
  const message = input.message.trim();
  const authorName = input.authorName.trim();
  const authorEmail = input.authorEmail.trim();

  if (message === "") {
    return fail("GIT_COMMIT_INVALID_INPUT", "コミットメッセージを入力してください。");
  }

  if (authorName === "") {
    return fail("GIT_COMMIT_INVALID_INPUT", "GitHub接続情報からコミット作成者を確認できませんでした。");
  }

  if (authorEmail === "" || !authorEmail.includes("@")) {
    return fail("GIT_COMMIT_INVALID_INPUT", "GitHub接続情報からコミット用メールアドレスを確認できませんでした。");
  }

  return ok({
    authorEmail,
    authorName,
    message
  });
}

export function normalizeGitHubRemoteUrl(url: string): RelicResult<string> {
  const trimmed = url.trim();

  if (trimmed === "") {
    return fail("GIT_REMOTE_INVALID_INPUT", "GitHubリポジトリのURLを入力してください。");
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
      return fail("GIT_REMOTE_INVALID_INPUT", "GitHubのHTTPSリポジトリURLを入力してください。");
    }

    const segments = parsed.pathname.split("/").filter(Boolean);

    if (segments.length !== 2) {
      return fail("GIT_REMOTE_INVALID_INPUT", "URLの形式が正しくありません。");
    }

    const repositoryPath = segments.join("/");

    return ok(`https://github.com/${repositoryPath.endsWith(".git") ? repositoryPath : `${repositoryPath}.git`}`);
  } catch (error) {
    return fail(
      "GIT_REMOTE_INVALID_INPUT",
      "GitHubリポジトリURLを読み取れませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function toGitAuth(accessToken: string): { password: string; username: string } {
  return {
    password: accessToken,
    username: "x-access-token"
  };
}
