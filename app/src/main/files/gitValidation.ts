import type { CreateGitCommitInput, CreateGitTagInput } from "../../shared/ipc";
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

export function normalizeBranchName(name: string): RelicResult<string> {
  const trimmed = name.trim();

  if (trimmed === "") {
    return fail("GIT_BRANCH_INVALID_INPUT", "ブランチ名を入力してください。");
  }

  if (trimmed.includes(" ") || trimmed.startsWith(".") || trimmed.endsWith(".") || trimmed.includes("..")) {
    return fail("GIT_BRANCH_INVALID_INPUT", "ブランチ名の形式が正しくありません。");
  }

  return ok(trimmed);
}

export function normalizeTagName(name: string): RelicResult<string> {
  const trimmed = name.trim();

  if (trimmed === "") {
    return fail("GIT_TAG_INVALID_INPUT", "タグ名を入力してください。");
  }

  if (
    trimmed.includes(" ") ||
    trimmed.startsWith(".") ||
    trimmed.endsWith(".") ||
    trimmed.includes("..") ||
    trimmed.includes("^") ||
    trimmed.includes(":") ||
    trimmed.includes("~")
  ) {
    return fail("GIT_TAG_INVALID_INPUT", "タグ名の形式が正しくありません。");
  }

  return ok(trimmed);
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

export function validateTagInput(
  input: CreateGitTagInput
): RelicResult<Required<Pick<CreateGitTagInput, "hash" | "name">> & Pick<CreateGitTagInput, "message"> & {
  taggerEmail: string;
  taggerName: string;
}> {
  const normalizedName = normalizeTagName(input.name);

  if (!normalizedName.ok) {
    return normalizedName;
  }

  const hash = input.hash?.trim() || "HEAD";
  const message = input.message?.trim() || "";
  const taggerName = input.taggerName?.trim() || "";
  const taggerEmail = input.taggerEmail?.trim() || "";

  if (message !== "") {
    if (taggerName === "") {
      return fail("GIT_TAG_INVALID_INPUT", "GitHub接続情報からタグ作成者を確認できませんでした。");
    }

    if (taggerEmail === "" || !taggerEmail.includes("@")) {
      return fail("GIT_TAG_INVALID_INPUT", "GitHub接続情報からタグ用メールアドレスを確認できませんでした。");
    }
  }

  return ok({
    hash,
    message: message === "" ? undefined : message,
    name: normalizedName.value,
    taggerEmail,
    taggerName
  });
}
