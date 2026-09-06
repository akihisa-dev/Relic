import { relicClient } from "../relicClient";

import type { WorkspaceState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";
import { useT } from "../i18n";
import { useWorkspaceResourceController } from "./useWorkspaceResourceState";

interface UseWorkspaceAliasesInput {
  contentRevision?: number;
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

const loadAliases = () => {
  const client = relicClient.current;
  if (!client) throw new Error("Relic API is unavailable.");
  return client.getWorkspaceAliases();
};
const emptyAliases: AliasIndex = {};

export function useWorkspaceAliases({
  contentRevision = 0,
  setWorkspaceError,
  workspaceState
}: UseWorkspaceAliasesInput): AliasIndex {
  const t = useT();
  const workspaceId = workspaceState?.activeWorkspace?.id ?? "";
  const { state } = useWorkspaceResourceController({
    available: Boolean(workspaceId && relicClient.current),
    loadFailedMessage: t("errors.operationFailed"),
    loadResource: loadAliases,
    onError: setWorkspaceError,
    refreshToken: workspaceState?.fileTree,
    retainWhileRefreshing: true,
    revision: contentRevision,
    workspaceId
  });
  return workspaceId && state.status === "ready" ? state.value : emptyAliases;
}
