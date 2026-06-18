import { useCallback, useEffect, useState } from "react";

import type {
  RelicApi,
  UpdateChartEntryInput,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { relicApiContractVersion } from "../../shared/ipc";
import {
  normalizeWorkspaceCharts,
  normalizeWorkspaceChartsWithFiles
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
    if (!isRelicApiContractCompatible(window.relic)) {
      setCharts([]);
      setWorkspaceError(apiContractMismatchMessage());
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
      return;
    }

    let canceled = false;

    if (!isRelicApiContractCompatible(window.relic)) {
      setCharts([]);
      setWorkspaceError(apiContractMismatchMessage());
      return;
    }

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
    if (!isRelicApiContractCompatible(relic)) {
      setWorkspaceError(apiContractMismatchMessage());
      return;
    }

    let result: Awaited<ReturnType<RelicApi["updateChartEntry"]>>;
    try {
      result = await relic.updateChartEntry(input);
    } catch {
      setWorkspaceError("チャート更新APIでエラーが発生しました。Relicを再起動してからもう一度お試しください。");
      return;
    }

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
    charts: workspaceState?.activeWorkspace ? charts : [],
    handleUpdateChartEntry,
    reloadCharts
  };
}

export function isRelicApiContractCompatible(relic: RelicApi | undefined): relic is RelicApi {
  return relic?.apiContractVersion === relicApiContractVersion;
}

export function apiContractMismatchMessage(): string {
  return "Relicの内部API契約が一致しません。Relicを再起動してからもう一度お試しください。";
}
