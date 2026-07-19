import { useMemo } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { useAppWorkspaceCollections } from "./useAppWorkspaceCollections";
import { useWorkspaceAliases } from "./useWorkspaceAliases";
import { useWorkspaceCharts } from "./useWorkspaceCharts";
import { useWorkspaceChronicleCalendarSettings } from "./useWorkspaceChronicleCalendarSettings";
import { useWorkspaceFrontmatterCategoryChoices } from "./useWorkspaceFrontmatterCategoryChoices";
import type { useWorkspaceSearchState } from "./useWorkspaceSearchState";

interface UseAppWorkspaceDerivedDataOptions {
  frontmatterCandidates: ReturnType<typeof useWorkspaceSearchState>["frontmatterCandidates"];
  hasOpenChart: boolean;
  setWorkspaceError: Parameters<typeof useWorkspaceAliases>[0]["setWorkspaceError"];
  tabs: Parameters<typeof useAppWorkspaceCollections>[0]["tabs"];
  workspaceState: WorkspaceState | null;
}

export function useAppWorkspaceDerivedData({
  frontmatterCandidates,
  hasOpenChart,
  setWorkspaceError,
  tabs,
  workspaceState
}: UseAppWorkspaceDerivedDataOptions) {
  const collections = useAppWorkspaceCollections({ tabs, workspaceState });
  const aliasesByPath = useWorkspaceAliases({ setWorkspaceError, workspaceState });
  const { charts, reloadCharts } = useWorkspaceCharts({
    hasOpenChart,
    setWorkspaceError,
    workspaceState
  });
  const { categoryChoices, handleSaveCategoryChoices } = useWorkspaceFrontmatterCategoryChoices({
    setWorkspaceError,
    workspaceState
  });
  const { calendarSettings, handleSaveCalendarSettings } = useWorkspaceChronicleCalendarSettings({
    onSaved: () => { void reloadCharts(); },
    setWorkspaceError,
    workspaceState
  });
  const frontmatterCandidatesWithCategory = useMemo(() => ({
    ...frontmatterCandidates,
    category: categoryChoices,
    chronicle: [calendarSettings.baseCalendarName, ...calendarSettings.calendars.map((calendar) => calendar.name)]
  }), [calendarSettings, categoryChoices, frontmatterCandidates]);

  return {
    ...collections,
    aliasesByPath,
    calendarSettings,
    categoryChoices,
    charts,
    frontmatterCandidatesWithCategory,
    handleSaveCalendarSettings,
    handleSaveCategoryChoices,
    reloadCharts
  };
}
