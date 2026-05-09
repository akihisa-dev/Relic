import { beforeEach, describe, expect, it, vi } from "vitest";

const keychainMock = vi.hoisted(() => ({
  deleteGitHubAuthFromKeychain: vi.fn(),
  readGitHubAuthFromKeychain: vi.fn()
}));

vi.mock("./keychain", () => keychainMock);

import {
  disconnectGitHubAccount,
  getGitHubOAuthConfig,
  parseGitHubScopeHeader,
  readGitHubAuthStatus
} from "./auth";

describe("github auth helpers", () => {
  beforeEach(() => {
    keychainMock.deleteGitHubAuthFromKeychain.mockReset();
    keychainMock.readGitHubAuthFromKeychain.mockReset();
  });

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

  it("認証状態はトークンを返さない", async () => {
    keychainMock.readGitHubAuthFromKeychain.mockResolvedValue({
      accessToken: "secret-access-token",
      login: "akihisa",
      scopes: ["repo"],
      tokenExpiresAt: null,
      tokenType: "bearer"
    });

    await expect(
      readGitHubAuthStatus({ clientId: "client-id", scopes: [] })
    ).resolves.toEqual({
      ok: true,
      value: {
        configured: true,
        connected: true,
        login: "akihisa",
        scopes: ["repo"],
        tokenType: "bearer"
      }
    });
  });

  it("ログアウト後はKeychainを削除し、未接続状態を返す", async () => {
    keychainMock.deleteGitHubAuthFromKeychain.mockResolvedValue(undefined);
    keychainMock.readGitHubAuthFromKeychain.mockResolvedValue(null);

    await expect(
      disconnectGitHubAccount({ clientId: "client-id", scopes: [] })
    ).resolves.toEqual({
      ok: true,
      value: {
        configured: true,
        connected: false,
        login: null,
        scopes: [],
        tokenType: null
      }
    });
    expect(keychainMock.deleteGitHubAuthFromKeychain).toHaveBeenCalledOnce();
  });
});
