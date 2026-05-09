import { dialog, shell } from "electron";

import { fail, ok, type RelicResult } from "../../shared/result";
import type { GitHubIntegrationSettings } from "../../shared/ipc";
import {
  deleteGitHubAuthFromKeychain,
  readGitHubAuthFromKeychain,
  saveGitHubAuthToKeychain
} from "./keychain";

const githubDeviceCodeEndpoint = "https://github.com/login/device/code";
const githubTokenEndpoint = "https://github.com/login/oauth/access_token";
const githubUserEndpoint = "https://api.github.com/user";
const defaultGithubScopes: string[] = [];
const deviceGrantType = "urn:ietf:params:oauth:grant-type:device_code";

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface GitHubDeviceCodeResponse {
  device_code?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  interval?: number;
  user_code?: string;
  verification_uri?: string;
}

interface GitHubUserResponse {
  login?: string;
}

export interface GitHubOAuthConfig {
  clientId: string;
  scopes: string[];
}

export interface GitHubAuthStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
  scopes: string[];
  tokenType: string | null;
}

export async function readGitHubAuthStatus(
  settings: GitHubIntegrationSettings
): Promise<RelicResult<GitHubAuthStatus>> {
  try {
    const stored = await readGitHubAuthFromKeychain();

    return ok({
      configured: getGitHubOAuthConfig(settings) !== null,
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

export async function connectGitHubAccount(
  settings: GitHubIntegrationSettings
): Promise<RelicResult<GitHubAuthStatus>> {
  const config = getGitHubOAuthConfig(settings);

  if (!config) {
    return fail(
      "GITHUB_OAUTH_NOT_CONFIGURED",
      "GitHub連携の設定がありません。`RELIC_GITHUB_CLIENT_ID` を設定してください。"
    );
  }

  try {
    const device = await requestGitHubDeviceCode(config);
    const promptResult = await dialog.showMessageBox({
      buttons: ["GitHubを開く", "キャンセル"],
      cancelId: 1,
      defaultId: 0,
      detail: `表示されたページで次のコードを入力してください。\n\n${device.userCode}`,
      message: "GitHub連携を開始します",
      noLink: true,
      type: "info"
    });

    if (promptResult.response !== 0) {
      return fail("GITHUB_OAUTH_CANCELLED", "GitHub連携をキャンセルしました。");
    }

    await shell.openExternal(device.verificationUri);

    const codeConfirmedResult = await dialog.showMessageBox({
      buttons: ["入力したので接続を続ける", "キャンセル"],
      cancelId: 1,
      defaultId: 0,
      detail: `GitHubのDevice Activation画面に、次のコードを入力してください。\n\n${device.userCode}\n\nGitHub側でContinueと認可を完了してから、このボタンを押してください。`,
      message: "GitHubに入力するコード",
      noLink: true,
      type: "info"
    });

    if (codeConfirmedResult.response !== 0) {
      return fail("GITHUB_OAUTH_CANCELLED", "GitHub連携をキャンセルしました。");
    }

    const tokenResponse = await pollGitHubDeviceToken(config, device);
    const accessToken = tokenResponse.access_token?.trim();

    if (!accessToken) {
      return fail(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub の認証コードをアクセストークンに交換できませんでした。",
        sanitizeGitHubOAuthDetail(tokenResponse.error_description ?? tokenResponse.error)
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
      tokenExpiresAt: secondsFromNowToIsoString(tokenResponse.expires_in),
      tokenType: tokenResponse.token_type?.trim() || "bearer"
    });

    return readGitHubAuthStatus(settings);
  } catch (error) {
    return fail(
      "GITHUB_OAUTH_CONNECT_FAILED",
      "GitHubアカウントを接続できませんでした。",
      sanitizeGitHubOAuthDetail(error instanceof Error ? error.message : String(error))
    );
  }
}

export async function disconnectGitHubAccount(
  settings: GitHubIntegrationSettings
): Promise<RelicResult<GitHubAuthStatus>> {
  try {
    await deleteGitHubAuthFromKeychain();
    return readGitHubAuthStatus(settings);
  } catch (error) {
    return fail(
      "GITHUB_OAUTH_DISCONNECT_FAILED",
      "GitHub接続を解除できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function getGitHubOAuthConfig(
  settings: GitHubIntegrationSettings
): GitHubOAuthConfig | null {
  const clientId = settings.clientId.trim();

  if (!clientId) {
    return null;
  }

  return {
    clientId,
    scopes: settings.scopes.length > 0 ? settings.scopes : defaultGithubScopes
  };
}

export interface GitHubDevicePrompt {
  deviceCode: string;
  expiresIn: number;
  interval: number;
  userCode: string;
  verificationUri: string;
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


async function requestGitHubDeviceCode(config: GitHubOAuthConfig): Promise<GitHubDevicePrompt> {
  const body = new URLSearchParams({
    client_id: config.clientId
  });

  if (config.scopes.length > 0) {
    body.set("scope", config.scopes.join(" "));
  }

  const response = await fetch(githubDeviceCodeEndpoint, {
    body,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`GitHub のデバイス認証開始に失敗しました: ${response.status}`);
  }

  const json = (await response.json()) as GitHubDeviceCodeResponse;

  if (json.error) {
    throw new Error(json.error_description ?? json.error);
  }

  const deviceCode = json.device_code?.trim();
  const userCode = json.user_code?.trim();
  const verificationUri = json.verification_uri?.trim();

  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error("GitHub のデバイス認証コードを取得できませんでした。");
  }

  const parsedVerificationUri = new URL(verificationUri);

  if (parsedVerificationUri.protocol !== "https:" || parsedVerificationUri.hostname !== "github.com") {
    throw new Error("GitHub のデバイス認証URLが不正です。");
  }

  return {
    deviceCode,
    expiresIn: normalizePositiveNumber(json.expires_in, 900),
    interval: normalizePositiveNumber(json.interval, 5),
    userCode,
    verificationUri
  };
}

async function pollGitHubDeviceToken(
  config: GitHubOAuthConfig,
  device: GitHubDevicePrompt
): Promise<GitHubTokenResponse> {
  const startedAt = Date.now();
  let intervalMs = device.interval * 1000;

  while (Date.now() - startedAt < device.expiresIn * 1000) {
    await delay(intervalMs);

    const response = await fetch(githubTokenEndpoint, {
      body: new URLSearchParams({
        client_id: config.clientId,
        device_code: device.deviceCode,
        grant_type: deviceGrantType
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    if (!response.ok) {
      throw new Error(`GitHub のデバイストークン取得に失敗しました: ${response.status}`);
    }

    const json = (await response.json()) as GitHubTokenResponse;

    if (!json.error) {
      return json;
    }

    if (json.error === "authorization_pending") {
      continue;
    }

    if (json.error === "slow_down") {
      intervalMs += 5000;
      continue;
    }

    if (json.error === "expired_token") {
      throw new Error("GitHub のデバイス認証コードの有効期限が切れました。");
    }

    throw new Error(json.error_description ?? json.error);
  }

  throw new Error("GitHub のデバイス認証の待ち時間が切れました。");
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

function sanitizeGitHubOAuthDetail(detail: string | undefined): string | undefined {
  if (!detail) {
    return undefined;
  }

  return detail
    .replace(/gh[opsu]_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/([?&](?:code|device_code|client_secret|access_token|refresh_token|token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(Authorization:\s*(?:token|bearer)\s+)[^\s]+/gi, "$1[redacted]");
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function secondsFromNowToIsoString(seconds: number | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000).toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
