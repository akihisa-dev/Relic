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
    if (!workspaceState?.activeWorkspace || !window.relic) {
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceChronicleCalendars().then((result) => {
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
    void window.relic?.saveWorkspaceChronicleCalendars(calendars).then((result) => {
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
