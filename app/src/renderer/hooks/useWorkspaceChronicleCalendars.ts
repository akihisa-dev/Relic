import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type WorkspaceState
} from "../../shared/ipc";

interface UseWorkspaceChronicleCalendarsInput {
  onSaved?: () => void;
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceChronicleCalendars({
  onSaved,
  setWorkspaceError,
  workspaceState
}: UseWorkspaceChronicleCalendarsInput): {
  chronicleCalendars: ChronicleCalendarSettings[];
  handleSaveChronicleCalendars: (calendars: ChronicleCalendarSettings[]) => void;
} {
  const [chronicleCalendars, setChronicleCalendars] = useState<ChronicleCalendarSettings[]>(defaultChronicleCalendars);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !relicClient.current) {
      return;
    }

    let canceled = false;

    void relicClient.current.getWorkspaceChronicleCalendars().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setChronicleCalendars(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id]);

  const handleSaveChronicleCalendars = useCallback((calendars: ChronicleCalendarSettings[]): void => {
    setChronicleCalendars(calendars);
    void relicClient.current?.saveWorkspaceChronicleCalendars(calendars).then((result) => {
      if (result.ok) {
        setChronicleCalendars(result.value);
        onSaved?.();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [onSaved, setWorkspaceError]);

  return {
    chronicleCalendars: workspaceState?.activeWorkspace ? chronicleCalendars : defaultChronicleCalendars,
    handleSaveChronicleCalendars
  };
}
