import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceTablePreferences } from "../../shared/ipc";
import { relicClient } from "../relicClient";
import { resetWorkspaceTableCache } from "./workspaceTableLoader";

interface UseWorkspaceTablePreferencesInput {
  initialPreferences: WorkspaceTablePreferences;
  saveFailedMessage: string;
}

interface WorkspaceTablePreferencesState {
  persist: (
    next: WorkspaceTablePreferences,
    rollback?: WorkspaceTablePreferences
  ) => Promise<void>;
  preferences: WorkspaceTablePreferences;
  retry: () => Promise<void>;
  saveError: string | null;
  setPreferences: (preferences: WorkspaceTablePreferences) => void;
}

export function useWorkspaceTablePreferences({
  initialPreferences,
  saveFailedMessage
}: UseWorkspaceTablePreferencesInput): WorkspaceTablePreferencesState {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveRevisionRef = useRef(0);
  const failedPreferencesRef = useRef<WorkspaceTablePreferences | null>(null);

  useEffect(() => {
    saveRevisionRef.current += 1;
    failedPreferencesRef.current = null;
    setSaveError(null);
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const persist = useCallback(async (
    next: WorkspaceTablePreferences,
    rollback?: WorkspaceTablePreferences
  ): Promise<void> => {
    const revision = ++saveRevisionRef.current;
    setPreferences(next);
    setSaveError(null);
    try {
      const result = await relicClient.current?.saveWorkspaceTablePreferences(next);
      if (revision !== saveRevisionRef.current) return;
      if (!result?.ok) {
        failedPreferencesRef.current = next;
        if (rollback) setPreferences(rollback);
        setSaveError(result?.error.message ?? saveFailedMessage);
        return;
      }
      failedPreferencesRef.current = null;
      setPreferences(result.value);
      resetWorkspaceTableCache();
    } catch {
      if (revision === saveRevisionRef.current) {
        failedPreferencesRef.current = next;
        if (rollback) setPreferences(rollback);
        setSaveError(saveFailedMessage);
      }
    }
  }, [saveFailedMessage]);

  const retry = useCallback(
    () => persist(failedPreferencesRef.current ?? preferences, preferences),
    [persist, preferences]
  );

  return {
    persist,
    preferences,
    retry,
    saveError,
    setPreferences
  };
}
