import { useCallback, useEffect, useState } from "react";

import {
  defaultChronicleCalendarSettings,
  type ChronicleCalendarSettings
} from "../../shared/chronicleCalendar";
import type { WorkspaceState } from "../../shared/ipc";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";
import { useAsyncRequestGuard } from "./useAsyncRequestGuard";

export function useWorkspaceChronicleCalendarSettings({
  onSaved,
  setWorkspaceError,
  workspaceState
}: {
  onSaved: () => void;
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}): {
  calendarSettings: ChronicleCalendarSettings;
  handleSaveCalendarSettings: (settings: ChronicleCalendarSettings) => void;
} {
  const t = useT();
  const workspaceId = workspaceState?.activeWorkspace?.id ?? null;
  const [snapshot, setSnapshot] = useState<{ settings: ChronicleCalendarSettings; workspaceId: string } | null>(null);
  const beginRequest = useAsyncRequestGuard([workspaceId]);

  useEffect(() => {
    const client = relicClient.current;
    if (!client || !workspaceId) return;
    const current = beginRequest();
    void client.getWorkspaceChronicleCalendarSettings().then((result) => {
      if (!current()) return;
      if (result.ok) setSnapshot({ settings: result.value, workspaceId });
      else setWorkspaceError(result.error.message);
    }).catch(() => {
      if (!current()) return;
      setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginRequest, setWorkspaceError, t, workspaceId]);

  const handleSaveCalendarSettings = useCallback((settings: ChronicleCalendarSettings): void => {
    const client = relicClient.current;
    if (!client || !workspaceId) return;
    const current = beginRequest();
    const previousSettings = snapshot?.workspaceId === workspaceId
      ? snapshot.settings
      : defaultChronicleCalendarSettings;
    setSnapshot({ settings, workspaceId });
    void client.saveWorkspaceChronicleCalendarSettings({ settings, workspaceId }).then((result) => {
      if (!current()) return;
      if (result.ok) {
        setSnapshot({ settings: result.value, workspaceId });
        onSaved();
      } else {
        setSnapshot({ settings: previousSettings, workspaceId });
        setWorkspaceError(result.error.message);
      }
    }).catch(() => {
      if (!current()) return;
      setSnapshot({ settings: previousSettings, workspaceId });
      setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginRequest, onSaved, setWorkspaceError, snapshot, t, workspaceId]);

  return {
    calendarSettings: snapshot?.workspaceId === workspaceId ? snapshot.settings : defaultChronicleCalendarSettings,
    handleSaveCalendarSettings
  };
}
