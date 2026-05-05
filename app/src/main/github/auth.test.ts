import { describe, expect, it } from "vitest";

import {
  buildGitHubAuthorizeUrl,
  getGitHubOAuthConfig,
  parseGitHubScopeHeader
} from "./auth";

describe("github auth helpers", () => {
  it("環境変数から OAuth 設定を読み込む", () => {
    expect(
      getGitHubOAuthConfig({
        RELIC_GITHUB_CLIENT_ID: "client-id",
        RELIC_GITHUB_CLIENT_SECRET: "client-secret",
        RELIC_GITHUB_OAUTH_CALLBACK_PATH: "callback",
        RELIC_GITHUB_OAUTH_SCOPES: "repo,read:user"
      })
    ).toEqual({
      callbackPath: "/callback",
      clientId: "client-id",
      clientSecret: "client-secret",
      scopes: ["repo", "read:user"]
    });
  });

  it("クライアントIDまたはシークレットが欠けていると null を返す", () => {
    expect(getGitHubOAuthConfig({ RELIC_GITHUB_CLIENT_ID: "client-id" })).toBeNull();
    expect(getGitHubOAuthConfig({ RELIC_GITHUB_CLIENT_SECRET: "client-secret" })).toBeNull();
  });

  it("認可URLに必要なクエリを含める", () => {
    const url = new URL(
      buildGitHubAuthorizeUrl(
        {
          callbackPath: "/oauth/github/callback",
          clientId: "client-id",
          clientSecret: "client-secret",
          scopes: ["repo", "read:user"]
        },
        "http://127.0.0.1:4567/oauth/github/callback",
        "state-123"
      )
    );

    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:4567/oauth/github/callback");
    expect(url.searchParams.get("scope")).toBe("repo read:user");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("allow_signup")).toBe("false");
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
