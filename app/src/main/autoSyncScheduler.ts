import { app } from "electron";

import { autoSyncFeatureEnabled } from "../shared/ipc";
import { autoCommitAndPush, pullGitBranch } from "./files/git";
import { readGitHubAuthFromKeychain } from "./github/keychain";
import { readAppSettings } from "./settings/appSettings";
import { readWorkspaceSettings } from "./settings/workspaceSettings";
import { toWorkspaceState } from "./workspace/workspaceService";

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

function startAutoSyncTimer(intervalMinutes: number): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }

  autoSyncTimer = setInterval(() => {
    void runAutoSync();
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoSyncTimer(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
}

export async function refreshAutoSyncTimer(): Promise<void> {
  if (!autoSyncFeatureEnabled) {
    stopAutoSyncTimer();
    return;
  }

  const settings = await readAppSettings(app.getPath("userData"));
  const state = toWorkspaceState(settings);

  if (!state.activeWorkspace) {
    stopAutoSyncTimer();
    return;
  }

  const workspaceSettings = await readWorkspaceSettings(app.getPath("userData"), state.activeWorkspace.id);
  const { autoSync } = workspaceSettings;

  if (autoSync.autoPull || autoSync.autoPush) {
    startAutoSyncTimer(autoSync.intervalMinutes);
  } else {
    stopAutoSyncTimer();
  }
}

async function runAutoSync(): Promise<void> {
  if (!autoSyncFeatureEnabled) {
    return;
  }

  try {
    const settings = await readAppSettings(app.getPath("userData"));
    const state = toWorkspaceState(settings);

    if (!state.activeWorkspace) {
      return;
    }

    const workspaceSettings = await readWorkspaceSettings(app.getPath("userData"), state.activeWorkspace.id);
    const { autoSync } = workspaceSettings;
    const auth = autoSync.autoPush ? await readGitHubAuthFromKeychain() : null;

    if (autoSync.autoPull) {
      await pullGitBranch(state.activeWorkspace.path);
    }

    if (autoSync.autoPush && auth) {
      await autoCommitAndPush(state.activeWorkspace.path, auth.login, auth.accessToken);
    }
  } catch {
    // Auto-sync errors are silent — don't crash the app.
  }
}
