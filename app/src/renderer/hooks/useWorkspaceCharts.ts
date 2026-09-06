import { relicClient } from "../relicClient";

import type {
  RelicApi,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { relicApiContractVersion } from "../../shared/ipc";
import { normalizeWorkspaceCharts } from "../chartNormalize";
import { useT } from "../i18n";
import { useWorkspaceResourceController } from "./useWorkspaceResourceState";
import type { RelicResult } from "../../shared/result";

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
  const t = useT();
  const workspaceId = workspaceState?.activeWorkspace?.id ?? null;
  const { state, reload } = useWorkspaceResourceController({
    available: Boolean(workspaceId && relicClient.current),
    enabled: hasOpenChart,
    loadFailedMessage: t("errors.operationFailed"),
    loadResource: loadCharts,
    onError: setWorkspaceError,
    retainWhileRefreshing: true,
    revision: 0,
    workspaceId: workspaceId ?? ""
  });
  return {
    charts: workspaceId && hasOpenChart && state.status === "ready" ? state.value : [],
    reloadCharts: reload
  };
}

async function loadCharts(): Promise<RelicResult<WorkspaceChart[]>> {
  const client = relicClient.current;
  if (!isRelicApiContractCompatible(client)) {
    return { ok: false, error: { code: "API_CONTRACT_MISMATCH", message: apiContractMismatchMessage() } };
  }
  const result = await client.getWorkspaceCharts();
  return result.ok ? { ok: true, value: normalizeWorkspaceCharts(result.value) } : result;
}

export function isRelicApiContractCompatible(relic: RelicApi | undefined): relic is RelicApi {
  return relic?.apiContractVersion === relicApiContractVersion;
}

export function apiContractMismatchMessage(): string {
  return "Relicの内部API契約が一致しません。Relicを再起動してからもう一度お試しください。";
}
