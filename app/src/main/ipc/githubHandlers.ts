import { app, ipcMain } from "electron";

import {
  connectGitHubChannel,
  disconnectGitHubChannel,
  getGitHubAuthStatusChannel,
  getGitHubIntegrationSettingsChannel,
  saveGitHubIntegrationSettingsChannel,
  type GitHubIntegrationSettings,
  type GitHubAuthStatus
} from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import { fail, ok } from "../../shared/result";
import {
  connectGitHubAccount,
  disconnectGitHubAccount,
  readGitHubAuthStatus
} from "../github/auth";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";

export function registerGitHubHandlers(): void {
  ipcMain.handle(
    getGitHubAuthStatusChannel,
    async (): Promise<RelicResult<GitHubAuthStatus>> => {
      const settings = await readAppSettings(app.getPath("userData"));
      return readGitHubAuthStatus(settings.githubIntegration);
    }
  );

  ipcMain.handle(
    connectGitHubChannel,
    async (): Promise<RelicResult<GitHubAuthStatus>> => {
      const settings = await readAppSettings(app.getPath("userData"));
      return connectGitHubAccount(settings.githubIntegration);
    }
  );

  ipcMain.handle(
    disconnectGitHubChannel,
    async (): Promise<RelicResult<GitHubAuthStatus>> => {
      const settings = await readAppSettings(app.getPath("userData"));
      return disconnectGitHubAccount(settings.githubIntegration);
    }
  );

  ipcMain.handle(
    getGitHubIntegrationSettingsChannel,
    async (): Promise<RelicResult<GitHubIntegrationSettings>> => {
      try {
        const settings = await readAppSettings(app.getPath("userData"));
        return ok(settings.githubIntegration);
      } catch (error) {
        return fail(
          "GITHUB_INTEGRATION_SETTINGS_FAILED",
          "GitHub連携設定を読み込めませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    saveGitHubIntegrationSettingsChannel,
    async (_event, input: GitHubIntegrationSettings): Promise<RelicResult<void>> => {
      try {
        if (!isGitHubIntegrationSettings(input)) {
          return fail("GITHUB_INTEGRATION_INVALID_INPUT", "GitHub連携設定の値が正しくありません。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        await writeAppSettings(app.getPath("userData"), {
          ...settings,
          githubIntegration: {
            clientId: input.clientId.trim(),
            scopes: input.scopes
          }
        });

        return ok(undefined);
      } catch (error) {
        return fail(
          "GITHUB_INTEGRATION_SAVE_FAILED",
          "GitHub連携設定を保存できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}

function isGitHubIntegrationSettings(input: unknown): input is GitHubIntegrationSettings {
  if (typeof input !== "object" || input === null) {
    return false;
  }

  const candidate = input as Partial<GitHubIntegrationSettings>;

  return (
    typeof candidate.clientId === "string" &&
    Array.isArray(candidate.scopes) &&
    candidate.scopes.every((scope) => typeof scope === "string" && /^[A-Za-z0-9:_-]+$/.test(scope))
  );
}
