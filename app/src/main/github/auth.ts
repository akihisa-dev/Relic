import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { shell } from "electron";

import { fail, ok, type RelicResult } from "../../shared/result";
import {
  deleteGitHubAuthFromKeychain,
  readGitHubAuthFromKeychain,
  saveGitHubAuthToKeychain
} from "./keychain";

const githubAuthorizeEndpoint = "https://github.com/login/oauth/authorize";
const githubTokenEndpoint = "https://github.com/login/oauth/access_token";
const githubUserEndpoint = "https://api.github.com/user";
const defaultCallbackPath = "/oauth/github/callback";
const defaultGithubScopes = ["repo"];
const oauthTimeoutMs = 120_000;

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  scope?: string;
  token_type?: string;
}

interface GitHubUserResponse {
  login?: string;
}

export interface GitHubOAuthConfig {
  callbackPath: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export interface GitHubAuthStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
  scopes: string[];
  tokenType: string | null;
}

export async function readGitHubAuthStatus(): Promise<RelicResult<GitHubAuthStatus>> {
  try {
    const stored = await readGitHubAuthFromKeychain();

    return ok({
      configured: getGitHubOAuthConfig() !== null,
      connected: stored !== null,
      login: stored?.login ?? null,
      scopes: stored?.scopes ?? [],
      tokenType: stored?.tokenType ?? null
    });
  } catch (error) {
    return fail(
      "GITHUB_AUTH_STATUS_FAILED",
      "GitHub接続状態を確認できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function connectGitHubAccount(): Promise<RelicResult<GitHubAuthStatus>> {
  const config = getGitHubOAuthConfig();

  if (!config) {
    return fail(
      "GITHUB_OAUTH_NOT_CONFIGURED",
      "GitHub OAuth の設定がありません。`RELIC_GITHUB_CLIENT_ID` と `RELIC_GITHUB_CLIENT_SECRET` を設定してください。"
    );
  }

  let callbackServer: ReturnType<typeof createServer> | null = null;

  try {
    const state = randomBytes(16).toString("hex");
    const callback = await createGitHubCallbackServer(config.callbackPath, state);
    callbackServer = callback.server;

    await shell.openExternal(buildGitHubAuthorizeUrl(config, callback.redirectUri, state));

    const code = await callback.codePromise;
    const tokenResponse = await exchangeGitHubOAuthCode(config, code, callback.redirectUri);
    const accessToken = tokenResponse.access_token?.trim();

    if (!accessToken) {
      return fail(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub の認証コードをアクセストークンに交換できませんでした。",
        tokenResponse.error_description ?? tokenResponse.error
      );
    }

    const profile = await fetchGitHubUser(accessToken);
    const scopes =
      profile.scopes.length > 0
        ? profile.scopes
        : parseGitHubScopeHeader(tokenResponse.scope ?? null);

    await saveGitHubAuthToKeychain({
      accessToken,
      login: profile.login,
      scopes,
      tokenType: tokenResponse.token_type?.trim() || "bearer"
    });

    return readGitHubAuthStatus();
  } catch (error) {
    return fail(
      "GITHUB_OAUTH_CONNECT_FAILED",
      "GitHubアカウントを接続できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    callbackServer?.close();
  }
}

export async function disconnectGitHubAccount(): Promise<RelicResult<GitHubAuthStatus>> {
  try {
    await deleteGitHubAuthFromKeychain();
    return readGitHubAuthStatus();
  } catch (error) {
    return fail(
      "GITHUB_OAUTH_DISCONNECT_FAILED",
      "GitHub接続を解除できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function getGitHubOAuthConfig(
  env: NodeJS.ProcessEnv = process.env
): GitHubOAuthConfig | null {
  const clientId = env.RELIC_GITHUB_CLIENT_ID?.trim();
  const clientSecret = env.RELIC_GITHUB_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  const rawScopes = env.RELIC_GITHUB_OAUTH_SCOPES?.trim();
  const scopes = rawScopes
    ? rawScopes.split(",").map((scope) => scope.trim()).filter(Boolean)
    : defaultGithubScopes;

  return {
    callbackPath: normalizeCallbackPath(env.RELIC_GITHUB_OAUTH_CALLBACK_PATH),
    clientId,
    clientSecret,
    scopes
  };
}

export function buildGitHubAuthorizeUrl(
  config: GitHubOAuthConfig,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    allow_signup: "false",
    client_id: config.clientId,
    prompt: "select_account",
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state
  });

  return `${githubAuthorizeEndpoint}?${params.toString()}`;
}

export function parseGitHubScopeHeader(scopeHeader: string | null): string[] {
  if (!scopeHeader) {
    return [];
  }

  return scopeHeader
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function createGitHubCallbackServer(
  callbackPath: string,
  expectedState: string
): Promise<{
  codePromise: Promise<string>;
  redirectUri: string;
  server: ReturnType<typeof createServer>;
}> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("GitHub OAuth のコールバック待ち受けポートを取得できませんでした。");
  }

  const redirectUri = `http://127.0.0.1:${(address as AddressInfo).port}${callbackPath}`;
  const codePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("GitHub 認証の待ち時間が切れました。もう一度お試しください。"));
    }, oauthTimeoutMs);

    const cleanup = (): void => {
      clearTimeout(timeout);
      server.removeAllListeners("request");
    };

    server.on("request", (request, response) => {
      try {
        const url = new URL(request.url ?? "/", redirectUri);

        if (url.pathname !== callbackPath) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        if (error) {
          response.statusCode = 400;
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end("<html><body><p>GitHub authorization failed. You can close this window.</p></body></html>");
          cleanup();
          reject(new Error(errorDescription ?? error));
          return;
        }

        if (returnedState !== expectedState) {
          response.statusCode = 400;
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end("<html><body><p>Invalid OAuth state. You can close this window.</p></body></html>");
          cleanup();
          reject(new Error("GitHub OAuth の state 検証に失敗しました。"));
          return;
        }

        if (!code) {
          response.statusCode = 400;
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end("<html><body><p>Missing authorization code. You can close this window.</p></body></html>");
          cleanup();
          reject(new Error("GitHub から認証コードを受け取れませんでした。"));
          return;
        }

        response.statusCode = 200;
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end("<html><body><p>GitHub authorization completed. You can close this window and return to Relic.</p></body></html>");
        cleanup();
        resolve(code);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  });

  return {
    codePromise,
    redirectUri,
    server
  };
}

async function exchangeGitHubOAuthCode(
  config: GitHubOAuthConfig,
  code: string,
  redirectUri: string
): Promise<GitHubTokenResponse> {
  const response = await fetch(githubTokenEndpoint, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`GitHub のトークン交換に失敗しました: ${response.status}`);
  }

  return (await response.json()) as GitHubTokenResponse;
}

async function fetchGitHubUser(
  accessToken: string
): Promise<{ login: string; scopes: string[] }> {
  const response = await fetch(githubUserEndpoint, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${accessToken}`,
      "User-Agent": "Relic"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub のユーザー情報取得に失敗しました: ${response.status}`);
  }

  const user = (await response.json()) as GitHubUserResponse;
  const login = user.login?.trim();

  if (!login) {
    throw new Error("GitHub のユーザー名を取得できませんでした。");
  }

  return {
    login,
    scopes: parseGitHubScopeHeader(response.headers.get("x-oauth-scopes"))
  };
}

function normalizeCallbackPath(rawPath: string | undefined): string {
  const trimmed = rawPath?.trim();

  if (!trimmed) {
    return defaultCallbackPath;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
