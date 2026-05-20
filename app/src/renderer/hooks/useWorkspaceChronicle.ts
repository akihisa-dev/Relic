import { useCallback, useEffect, useState } from "react";

import type {
  UpdateGanttChartEntryInput,
  WorkspaceGanttChart,
  WorkspaceState
} from "../../shared/ipc";
import {
  normalizeWorkspaceChronicle,
  normalizeWorkspaceChronicleWithFiles,
  updateChronicleEntryFallback
} from "../chronicleChartData";
import type { Tab } from "../store/editorStore";

interface UseWorkspaceChronicleInput {
  hasOpenChronicle: boolean;
  setWorkspaceError: (message: string | null) => void;
  tabs: Record<string, Tab>;
  updateTabContent: (tabId: string, content: string) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceChronicle({
  hasOpenChronicle,
  setWorkspaceError,
  tabs,
  updateTabContent,
  workspaceState
}: UseWorkspaceChronicleInput): {
  chronicleCharts: WorkspaceGanttChart[];
  handleUpdateChronicleEntry: (input: UpdateGanttChartEntryInput) => Promise<void>;
  reloadChronicle: () => Promise<void>;
} {
  const [chronicleCharts, setChronicleCharts] = useState<WorkspaceGanttChart[]>([]);

  const reloadChronicle = useCallback(async (): Promise<void> => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setChronicleCharts([]);
      return;
    }

    const result = await window.relic.getWorkspaceChronicle();

    if (result.ok) {
      const normalized = hasOpenChronicle
        ? await normalizeWorkspaceChronicleWithFiles(result.value, workspaceState.fileTree, window.relic.readMarkdownFile)
        : normalizeWorkspaceChronicle(result.value);
      setChronicleCharts(normalized);
    } else {
      setChronicleCharts([]);
      setWorkspaceError(result.error.message);
    }
  }, [hasOpenChronicle, setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setChronicleCharts([]);
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceChronicle().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setChronicleCharts(normalizeWorkspaceChronicle(result.value));
      } else {
        setChronicleCharts([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!hasOpenChronicle) return;
    void reloadChronicle();
  }, [hasOpenChronicle, reloadChronicle]);

  const handleUpdateChronicleEntry = useCallback(async (input: UpdateGanttChartEntryInput): Promise<void> => {
    if (!window.relic) return;

    const relic = window.relic;
    const updateEntry = (relic as Partial<typeof relic>).updateGanttChartEntry;
    const result = typeof updateEntry === "function"
      ? await updateEntry(input).catch(() => updateChronicleEntryFallback(input, relic))
      : await updateChronicleEntryFallback(input, relic);

    if (result.ok) {
      setChronicleCharts(await normalizeWorkspaceChronicleWithFiles(result.value, workspaceState?.fileTree ?? [], relic.readMarkdownFile));
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
    chronicleCharts,
    handleUpdateChronicleEntry,
    reloadChronicle
  };
}
