import { relicClient } from "../relicClient";
import { useCallback, useState } from "react";

import { useT } from "../i18n";
import type { RelicError, WorkspaceMutationRecovery } from "../../shared/result";
import type { TranslationKey, Translator } from "../../shared/i18n";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import { useAsyncRequestGuard } from "./useAsyncRequestGuard";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

type WorkspaceRegistryInput = Pick<
  WorkspaceFileActionsContext,
  "closeAllTabs" | "setWorkspaceError" | "setWorkspaceState"
> & {
  activeWorkspaceId?: string | null;
  activeWorkspacePath?: string | null;
  beforeCloseAllTabs?: () => Promise<boolean> | boolean;
} & WorkspaceRequestGuard;

export function useWorkspaceRegistryActions({
  activeWorkspaceId,
  activeWorkspacePath,
  beginWorkspaceRequest,
  beforeCloseAllTabs,
  closeAllTabs,
  invalidateWorkspaceRequests,
  setWorkspaceError,
  setWorkspaceState
}: WorkspaceRegistryInput) {
  const t = useT();
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isRelinkingWorkspace, setIsRelinkingWorkspace] = useState(false);
  const beginLatestActivationRequest = useAsyncRequestGuard([]);
  const beginWorkspaceActivationRequest = useCallback(() => {
    const isLatestActivation = beginLatestActivationRequest();
    const isOriginWorkspace = activeWorkspaceId === null
      ? () => true
      : beginWorkspaceRequest();
    return () => isLatestActivation() && isOriginWorkspace();
  }, [activeWorkspaceId, beginLatestActivationRequest, beginWorkspaceRequest]);
  const applyActivatedWorkspaceState = useCallback((state: Parameters<typeof setWorkspaceState>[0]): void => {
    invalidateWorkspaceRequests(state.activeWorkspace?.id ?? null);
    setWorkspaceState(state);
    closeAllTabs();
  }, [closeAllTabs, invalidateWorkspaceRequests, setWorkspaceState]);
  const applySelectedWorkspaceState = useCallback((state: Parameters<typeof setWorkspaceState>[0]): void => {
    const selectedWorkspace = state.activeWorkspace;
    const activeWorkspaceUnchanged = (selectedWorkspace?.id ?? null) === activeWorkspaceId
      && (selectedWorkspace?.path ?? null) === activeWorkspacePath;

    if (activeWorkspaceUnchanged) {
      setWorkspaceState(state);
      return;
    }

    applyActivatedWorkspaceState(state);
  }, [activeWorkspaceId, activeWorkspacePath, applyActivatedWorkspaceState, setWorkspaceState]);

  const handleOpenWorkspace = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      setIsOpeningWorkspace(true);
      setWorkspaceError(null);

      void relic
        .openWorkspace()
        .then((result) => {
          if (!isCurrentRequest()) return;
          if (result.ok) {
            applySelectedWorkspaceState(result.value);
          } else {
            setWorkspaceError(result.error.message);
          }
        })
        .catch(() => {
          if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
        })
        .finally(() => {
          if (isCurrentRequest()) setIsOpeningWorkspace(false);
        });
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError, t]);

  const handleCreateNewWorkspace = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      setIsCreatingWorkspace(true);
      setWorkspaceError(null);

      void relic
        .createNewWorkspace()
        .then((result) => {
          if (!isCurrentRequest()) return;
          if (result.ok) {
            applySelectedWorkspaceState(result.value);
          } else {
            setWorkspaceError(result.error.message);
          }
        })
        .catch(() => {
          if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
        })
        .finally(() => {
          if (isCurrentRequest()) setIsCreatingWorkspace(false);
        });
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError, t]);

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      void relic.switchWorkspace({ workspaceId }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          applySelectedWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      }).catch(() => {
        if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
      });
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError, t]);

  const handleRemoveWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = workspaceId === activeWorkspaceId
      ? beginWorkspaceActivationRequest()
      : beginWorkspaceRequest();
    if (!isCurrentRequest()) return;

    const removeWorkspace = (): void => {
      if (!isCurrentRequest()) return;
      void relic.removeWorkspace({ workspaceId }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          if (workspaceId === activeWorkspaceId) {
            applySelectedWorkspaceState(result.value);
          } else {
            setWorkspaceState(result.value);
          }
        } else {
          setWorkspaceError(result.error.message);
        }
      }).catch(() => {
        if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
      });
    };

    if (workspaceId === activeWorkspaceId) runAfterCloseCheck(beforeCloseAllTabs, removeWorkspace);
    else removeWorkspace();
  }, [activeWorkspaceId, applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, beginWorkspaceRequest, setWorkspaceError, setWorkspaceState, t]);

  const handleRelinkWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      setIsRelinkingWorkspace(true);
      setWorkspaceError(null);
      void relic.relinkWorkspace({ workspaceId }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          applySelectedWorkspaceState(result.value);
        } else {
          setWorkspaceError(workspaceRecoveryErrorMessage(result.error, t));
        }
      }).catch(() => {
        if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
      }).finally(() => {
        if (isCurrentRequest()) setIsRelinkingWorkspace(false);
      });
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError, t]);

  const handleRenameWorkspace = useCallback(async (workspaceId: string, name: string): Promise<boolean> => {
    if (!relicClient.current) return false;
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return false;

    let result: Awaited<ReturnType<NonNullable<typeof relicClient.current>["renameWorkspace"]>>;
    try {
      result = await relicClient.current.renameWorkspace({ name, workspaceId });
    } catch {
      if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
      return false;
    }
    if (!isCurrentRequest()) return false;
    if (result.ok) {
      // A case-only rename keeps the workspace id stable, but changes the
      // path and cache owner. Invalidate every in-flight request before
      // publishing the returned state so stale work cannot win the race.
      invalidateWorkspaceRequests(result.value.activeWorkspace?.id ?? null);
      setWorkspaceState(result.value);
      return true;
    }

    setWorkspaceError(workspaceRecoveryErrorMessage(result.error, t));
    return false;
  }, [activeWorkspaceId, beginWorkspaceRequest, invalidateWorkspaceRequests, setWorkspaceError, setWorkspaceState, t]);

  const handleRevealWorkspace = useCallback((workspaceId: string): void => {
    if (!relicClient.current) return;
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return;

    void relicClient.current.revealWorkspaceItem({ path: "", workspaceId }).then((result) => {
      if (!isCurrentRequest()) return;
      if (!result.ok) setWorkspaceError(result.error.message);
    }).catch(() => {
      if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginWorkspaceRequest, setWorkspaceError, t]);

  const handleRefreshWorkspaceState = useCallback((): void => {
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return;
    void relicClient.current?.getWorkspaceState().then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) {
        if (result.value.activeWorkspace?.id !== activeWorkspaceId) {
          invalidateWorkspaceRequests(result.value.activeWorkspace?.id ?? null);
        }
        setWorkspaceState(result.value);
      }
    }).catch(() => {
      if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [activeWorkspaceId, beginWorkspaceRequest, invalidateWorkspaceRequests, setWorkspaceError, setWorkspaceState, t]);

  const handleTogglePin = useCallback((path: string): void => {
    if (!relicClient.current) return;
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return;

    void relicClient.current.togglePin(path).then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    }).catch(() => {
      if (isCurrentRequest()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginWorkspaceRequest, setWorkspaceError, setWorkspaceState, t]);

  return {
    handleCreateNewWorkspace,
    handleOpenWorkspace,
    handleRefreshWorkspaceState,
    handleRelinkWorkspace,
    handleRevealWorkspace,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleTogglePin,
    isCreatingWorkspace,
    isOpeningWorkspace,
    isRelinkingWorkspace
  };
}

export function workspaceRecoveryErrorMessage(error: RelicError, t: Translator): string {
  const recovery = asWorkspaceMutationRecovery(error.recovery);
  if (!recovery) return error.message;

  const settingsMigration = localizedWorkspaceSettingsMigration(recovery.settingsMigration, t);
  const reason = localizedWorkspaceRecoveryReason(recovery.reason, t);

  if (recovery.status === "rolled-back") {
    return t("files.workspaceRecoveryRolledBack", {
      currentPath: recovery.currentPath ?? recovery.oldPath,
      oldPath: recovery.oldPath,
      reason,
      settingsMigration
    });
  }

  return t("files.workspaceRecoveryRequired", {
    currentPath: recovery.currentPath ?? t("files.workspaceRecoveryPathUnknown"),
    oldPath: recovery.oldPath,
    reason,
    settingsMigration
  });
}

const workspaceRecoveryReasonKeys: Record<string, TranslationKey> = {
  "destination-changed": "files.workspaceRecoveryReasonDestinationChanged",
  "destination-missing": "files.workspaceRecoveryReasonDestinationMissing",
  missing: "files.workspaceRecoveryReasonDestinationMissing",
  "rollback-completed": "files.workspaceRecoveryReasonRollbackCompleted",
  "rollback-failed": "files.workspaceRecoveryReasonRollbackFailed",
  "source-occupied": "files.workspaceRecoveryReasonSourceOccupied"
};

const workspaceSettingsMigrationKeys: Record<string, TranslationKey> = {
  "app-settings:write-failed": "files.workspaceRecoverySettingsAppWriteFailed",
  "directory-moved:missing": "files.workspaceRecoverySettingsDirectoryMissing",
  "directory-moved:unknown": "files.workspaceRecoverySettingsDirectoryUnknown",
  "new-settings:write-failed": "files.workspaceRecoverySettingsWriteFailed",
  "old-settings:remove-failed": "files.workspaceRecoverySettingsRemovalFailed",
  "preflight:destination-settings-occupied": "files.workspaceRecoverySettingsDestinationOccupied",
  "status:conflict": "files.workspaceRecoverySettingsConflict",
  "status:failed": "files.workspaceRecoverySettingsFailed",
  "status:not-started": "files.workspaceRecoverySettingsNotStarted",
  "status:old-preserved": "files.workspaceRecoverySettingsOldPreserved",
  "status:restored": "files.workspaceRecoverySettingsRestored"
};

function localizedWorkspaceRecoveryReason(reason: unknown, t: Translator): string {
  const key = typeof reason === "string" ? workspaceRecoveryReasonKeys[reason] : undefined;
  return t(key ?? "files.workspaceRecoveryReasonUnknown");
}

function localizedWorkspaceSettingsMigration(
  settingsMigration: WorkspaceMutationRecovery["settingsMigration"],
  t: Translator
): string {
  if (!settingsMigration || typeof settingsMigration !== "object") {
    return t("files.workspaceRecoverySettingsUnknown");
  }

  const phase = typeof settingsMigration.phase === "string" ? settingsMigration.phase : undefined;
  const status = typeof settingsMigration.status === "string" ? settingsMigration.status : undefined;
  const key = phase && status
    ? workspaceSettingsMigrationKeys[`${phase}:${status}`]
    : status
      ? workspaceSettingsMigrationKeys[`status:${status}`]
      : undefined;
  return t(key ?? "files.workspaceRecoverySettingsUnknown");
}

function asWorkspaceMutationRecovery(
  recovery: RelicError["recovery"]
): (WorkspaceMutationRecovery & { reason?: string }) | null {
  if (!recovery || typeof recovery !== "object") return null;
  if (typeof recovery.oldPath !== "string") return null;
  if (recovery.status !== "recovery-required" && recovery.status !== "rolled-back") return null;
  if (recovery.currentPath !== null && typeof recovery.currentPath !== "string") return null;
  return recovery as WorkspaceMutationRecovery & { reason?: string };
}

function runAfterCloseCheck(
  beforeCloseAllTabs: (() => Promise<boolean> | boolean) | undefined,
  action: () => void
): void {
  const canClose = beforeCloseAllTabs?.() ?? true;

  if (typeof canClose === "boolean") {
    if (canClose) action();
    return;
  }

  void canClose.then((result) => {
    if (result) action();
  }).catch(() => undefined);
}
