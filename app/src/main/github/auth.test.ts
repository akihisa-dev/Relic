import { describe, expect, it } from "vitest";

import {
  getGitHubOAuthConfig,
  parseGitHubScopeHeader
} from "./auth";

describe("github auth helpers", () => {
  it("環境変数から OAuth 設定を読み込む", () => {
    expect(
      getGitHubOAuthConfig({
        clientId: "client-id",
        scopes: ["repo", "read:user"]
      })
    ).toEqual({
      clientId: "client-id",
      scopes: ["repo", "read:user"]
    });
  });

  it("クライアントIDが欠けていると null を返す", () => {
    expect(getGitHubOAuthConfig({ clientId: "", scopes: [] })).toBeNull();
  });

  it("scope ヘッダーを配列へ変換する", () => {
    expect(parseGitHubScopeHeader("repo, read:user , gist")).toEqual([
      "repo",
      "read:user",
      "gist"
    ]);
    expect(parseGitHubScopeHeader(null)).toEqual([]);
  });
});
