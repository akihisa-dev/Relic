import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import type {
  RelicApi,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { relicApiContractVersion } from "../../shared/ipc";
import { normalizeWorkspaceCharts } from "../chartData";
import { useAsyncRequestGuard } from "./useAsyncRequestGuard";

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
  const workspaceId = workspaceState?.activeWorkspace?.id ?? null;
  const [snapshot, setSnapshot] = useState<{ charts: WorkspaceChart[]; workspaceId: string } | null>(null);
  const beginRequest = useAsyncRequestGuard([workspaceId]);

  const reloadCharts = useCallback(async (): Promise<boolean> => {
    const client = relicClient.current;
    if (!workspaceId || !client) {
      return true;
    }
    const isCurrentRequest = beginRequest();
    if (!isRelicApiContractCompatible(client)) {
      if (!isCurrentRequest()) return false;
      setSnapshot({ charts: [], workspaceId });
      setWorkspaceError(apiContractMismatchMessage());
      return false;
    }

    const result = await client.getWorkspaceCharts();
    if (!isCurrentRequest()) return false;

    if (result.ok) {
      setSnapshot({ charts: normalizeWorkspaceCharts(result.value), workspaceId });
      return true;
    } else {
      setSnapshot({ charts: [], workspaceId });
      setWorkspaceError(result.error.message);
      return false;
    }
  }, [beginRequest, setWorkspaceError, workspaceId]);

  useEffect(() => {
    if (!hasOpenChart) return;

    void reloadCharts();
  }, [hasOpenChart, reloadCharts]);

  return {
    charts: workspaceId && hasOpenChart && snapshot?.workspaceId === workspaceId ? snapshot.charts : [],
    reloadCharts
  };
}

export function isRelicApiContractCompatible(relic: RelicApi | undefined): relic is RelicApi {
  return relic?.apiContractVersion === relicApiContractVersion;
}

export function apiContractMismatchMessage(): string {
  return "Relicの内部API契約が一致しません。Relicを再起動してからもう一度お試しください。";
}
