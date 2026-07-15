import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import type {
  RelicApi,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { relicApiContractVersion } from "../../shared/ipc";
import { normalizeWorkspaceCharts } from "../chartData";

interface UseWorkspaceChartsInput {
  hasOpenChart: boolean;
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceCharts({
  hasOpenChart,
  setWorkspaceError,
  workspaceState
}: UseWorkspaceChartsInput): {
  charts: WorkspaceChart[];
  reloadCharts: () => Promise<boolean>;
} {
  const [charts, setCharts] = useState<WorkspaceChart[]>([]);

  const reloadCharts = useCallback(async (): Promise<boolean> => {
    if (!workspaceState?.activeWorkspace || !relicClient.current) {
      setCharts([]);
      return true;
    }
    if (!isRelicApiContractCompatible(relicClient.current)) {
      setCharts([]);
      setWorkspaceError(apiContractMismatchMessage());
      return false;
    }

    const result = await relicClient.current.getWorkspaceCharts();

    if (result.ok) {
      setCharts(normalizeWorkspaceCharts(result.value));
      return true;
    } else {
      setCharts([]);
      setWorkspaceError(result.error.message);
      return false;
    }
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id]);

  useEffect(() => {
    if (!hasOpenChart) return;

    void reloadCharts();
  }, [hasOpenChart, reloadCharts]);

  return {
    charts: workspaceState?.activeWorkspace && hasOpenChart ? charts : [],
    reloadCharts
  };
}

export function isRelicApiContractCompatible(relic: RelicApi | undefined): relic is RelicApi {
  return relic?.apiContractVersion === relicApiContractVersion;
}

export function apiContractMismatchMessage(): string {
  return "Relicの内部API契約が一致しません。Relicを再起動してからもう一度お試しください。";
}
