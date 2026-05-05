import { ipcMain } from "electron";

import {
  connectGitHubChannel,
  disconnectGitHubChannel,
  getGitHubAuthStatusChannel,
  type GitHubAuthStatus
} from "../../shared/ipc";
import type { RelicResult } from "../../shared/result";
import {
  connectGitHubAccount,
  disconnectGitHubAccount,
  readGitHubAuthStatus
} from "../github/auth";

export function registerGitHubHandlers(): void {
  ipcMain.handle(
    getGitHubAuthStatusChannel,
    async (): Promise<RelicResult<GitHubAuthStatus>> => readGitHubAuthStatus()
  );

  ipcMain.handle(
    connectGitHubChannel,
    async (): Promise<RelicResult<GitHubAuthStatus>> => connectGitHubAccount()
  );

  ipcMain.handle(
    disconnectGitHubChannel,
    async (): Promise<RelicResult<GitHubAuthStatus>> => disconnectGitHubAccount()
  );
}
