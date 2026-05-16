import { useCallback, useEffect, useState } from "react";

import type {
  UpdateGanttChartEntryInput,
  WorkspaceGanttChart,
  WorkspaceState
} from "../../shared/ipc";
import {
  normalizeWorkspaceGanttCharts,
  normalizeWorkspaceGanttChartsWithFiles,
  updateGanttChartEntryFallback
} from "../ganttChartData";
import type { Tab } from "../store/editorStore";

interface UseWorkspaceGanttChartsInput {
  hasOpenGanttChart: boolean;
  setWorkspaceError: (message: string | null) => void;
  tabs: Record<string, Tab>;
  updateTabContent: (tabId: string, content: string) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceGanttCharts({
  hasOpenGanttChart,
  setWorkspaceError,
  tabs,
  updateTabContent,
  workspaceState
}: UseWorkspaceGanttChartsInput): {
  ganttCharts: WorkspaceGanttChart[];
  handleUpdateGanttChartEntry: (input: UpdateGanttChartEntryInput) => Promise<void>;
  reloadGanttCharts: () => Promise<void>;
} {
  const [ganttCharts, setGanttCharts] = useState<WorkspaceGanttChart[]>([]);

  const reloadGanttCharts = useCallback(async (): Promise<void> => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGanttCharts([]);
      return;
    }

    const result = await window.relic.getWorkspaceChronicle();

    if (result.ok) {
      const normalized = hasOpenGanttChart
        ? await normalizeWorkspaceGanttChartsWithFiles(result.value, workspaceState.fileTree, window.relic.readMarkdownFile)
        : normalizeWorkspaceGanttCharts(result.value);
      setGanttCharts(normalized);
    } else {
      setGanttCharts([]);
      setWorkspaceError(result.error.message);
    }
  }, [hasOpenGanttChart, setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGanttCharts([]);
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceChronicle().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGanttCharts(normalizeWorkspaceGanttCharts(result.value));
      } else {
        setGanttCharts([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!hasOpenGanttChart) return;
    void reloadGanttCharts();
  }, [hasOpenGanttChart, reloadGanttCharts]);

  const handleUpdateGanttChartEntry = useCallback(async (input: UpdateGanttChartEntryInput): Promise<void> => {
    if (!window.relic) return;

    const relic = window.relic;
    const updateEntry = (relic as Partial<typeof relic>).updateGanttChartEntry;
    const result = typeof updateEntry === "function"
      ? await updateEntry(input).catch(() => updateGanttChartEntryFallback(input, relic))
      : await updateGanttChartEntryFallback(input, relic);

    if (result.ok) {
      setGanttCharts(await normalizeWorkspaceGanttChartsWithFiles(result.value, workspaceState?.fileTree ?? [], relic.readMarkdownFile));
      const updatedFile = await relic.readMarkdownFile({ path: input.path });

      if (updatedFile.ok) {
        Object.values(tabs).forEach((tab) => {
          if (tab.kind === "file" && tab.path === input.path) {
            updateTabContent(tab.id, updatedFile.value.content);
          }
        });
      }
    } else {
      setWorkspaceError(result.error.message);
    }
  }, [setWorkspaceError, tabs, updateTabContent, workspaceState?.fileTree]);

  return {
    ganttCharts,
    handleUpdateGanttChartEntry,
    reloadGanttCharts
  };
}
