import { describe, expect, it } from "vitest";

import {
  normalizeBranchName,
  normalizeGitHubRemoteUrl,
  normalizeTagName,
  toGitAuth,
  validateCommitInput,
  validateTagInput
} from "./gitValidation";

describe("gitValidation", () => {
  it("コミット入力をtrimして検証する", () => {
    expect(validateCommitInput({
      authorEmail: " test@example.com ",
      authorName: " Test User ",
      message: " Initial commit "
    })).toEqual({
      ok: true,
      value: {
        authorEmail: "test@example.com",
        authorName: "Test User",
        message: "Initial commit"
      }
    });

    expect(validateCommitInput({ authorEmail: "test@example.com", authorName: "", message: "x" })).toMatchObject({
      ok: false,
      error: { code: "GIT_COMMIT_INVALID_INPUT" }
    });
  });

  it("ブランチ名を正規化する", () => {
    expect(normalizeBranchName(" feature/test ")).toEqual({ ok: true, value: "feature/test" });
    expect(normalizeBranchName("feature test")).toMatchObject({
      ok: false,
      error: { code: "GIT_BRANCH_INVALID_INPUT" }
    });
  });

  it("タグ名を正規化する", () => {
    expect(normalizeTagName(" v1.0.0 ")).toEqual({ ok: true, value: "v1.0.0" });
    expect(normalizeTagName("v1.0.0:bad")).toMatchObject({
      ok: false,
      error: { code: "GIT_TAG_INVALID_INPUT" }
    });
  });

  it("GitHub HTTPS URL を origin 用URLへ正規化する", () => {
    expect(normalizeGitHubRemoteUrl("https://github.com/akihisa/relic")).toEqual({
      ok: true,
      value: "https://github.com/akihisa/relic.git"
    });
    expect(normalizeGitHubRemoteUrl("git@github.com:akihisa/relic.git")).toMatchObject({
      ok: false,
      error: { code: "GIT_REMOTE_INVALID_INPUT" }
    });
  });

  it("注釈タグ入力を検証する", () => {
    expect(validateTagInput({
      message: " release ",
      name: " v1.0.0 ",
      taggerEmail: " test@example.com ",
      taggerName: " Test User "
    })).toEqual({
      ok: true,
      value: {
        hash: "HEAD",
        message: "release",
        name: "v1.0.0",
        taggerEmail: "test@example.com",
        taggerName: "Test User"
      }
    });

    expect(validateTagInput({ message: "release", name: "v1.0.0" })).toMatchObject({
      ok: false,
      error: { code: "GIT_TAG_INVALID_INPUT" }
    });
  });

  it("isomorphic-git 用のtoken認証値を作る", () => {
    expect(toGitAuth("secret-token")).toEqual({
      password: "secret-token",
      username: "x-access-token"
    });
  });
});
