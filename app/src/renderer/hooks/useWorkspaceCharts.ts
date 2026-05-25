import { useCallback, useEffect, useState } from "react";

import type {
  UpdateChartEntryInput,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import {
  normalizeWorkspaceCharts,
  normalizeWorkspaceChartsWithFiles,
  updateChartEntryFallback
} from "../chartData";
import type { Tab } from "../store/editorStore";

interface UseWorkspaceChartsInput {
  hasOpenChart: boolean;
  setWorkspaceError: (message: string | null) => void;
  tabs: Record<string, Tab>;
  updateTabContent: (tabId: string, content: string) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceCharts({
  hasOpenChart,
  setWorkspaceError,
  tabs,
  updateTabContent,
  workspaceState
}: UseWorkspaceChartsInput): {
  charts: WorkspaceChart[];
  handleUpdateChartEntry: (input: UpdateChartEntryInput) => Promise<void>;
  reloadCharts: () => Promise<void>;
} {
  const [charts, setCharts] = useState<WorkspaceChart[]>([]);

  const reloadCharts = useCallback(async (): Promise<void> => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setCharts([]);
      return;
    }

    const result = await window.relic.getWorkspaceCharts();

    if (result.ok) {
      const normalized = hasOpenChart
        ? await normalizeWorkspaceChartsWithFiles(result.value, workspaceState.fileTree, window.relic.readMarkdownFile)
        : normalizeWorkspaceCharts(result.value);
      setCharts(normalized);
    } else {
      setCharts([]);
      setWorkspaceError(result.error.message);
    }
  }, [hasOpenChart, setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setCharts([]);
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceCharts().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setCharts(normalizeWorkspaceCharts(result.value));
      } else {
        setCharts([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!hasOpenChart) return;
    void reloadCharts();
  }, [hasOpenChart, reloadCharts]);

  const handleUpdateChartEntry = useCallback(async (input: UpdateChartEntryInput): Promise<void> => {
    if (!window.relic) return;

    const relic = window.relic;
    const updateEntry = (relic as Partial<typeof relic>).updateChartEntry;
    const result = typeof updateEntry === "function"
      ? await updateEntry(input).catch(() => updateChartEntryFallback(input, relic))
      : await updateChartEntryFallback(input, relic);

    if (result.ok) {
      setCharts(await normalizeWorkspaceChartsWithFiles(result.value, workspaceState?.fileTree ?? [], relic.readMarkdownFile));
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
    charts,
    handleUpdateChartEntry,
    reloadCharts
  };
}
