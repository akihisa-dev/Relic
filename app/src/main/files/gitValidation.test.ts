import { describe, expect, it } from "vitest";

import {
  normalizeGitHubRemoteUrl,
  toGitAuth,
  validateCommitInput
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

  it("isomorphic-git 用のtoken認証値を作る", () => {
    expect(toGitAuth("secret-token")).toEqual({
      password: "secret-token",
      username: "x-access-token"
    });
  });
});
