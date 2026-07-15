import { useCallback } from "react";

import type { LinkUpdateImpactKind } from "../../shared/ipc/files";
import type { RelicResult } from "../../shared/result";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";

export type WorkspaceMutationItem = { path: string; type: "file" | "folder" };

export interface LinkImpactRequest {
  kind: LinkUpdateImpactKind;
  newPath: string;
  oldPath: string;
}

const linkUpdateImpactFileThreshold = 30;
const linkUpdateImpactLinkThreshold = 100;

export function useWorkspaceMutationRunner({
  beforeMutateWorkspaceItems,
  setWorkspaceError,
  t
}: Pick<WorkspaceFileActionsContext, "beforeMutateWorkspaceItems" | "setWorkspaceError"> & {
  t: Translator;
}) {
  const ensureCanMutateItems = useCallback(
    async (items: WorkspaceMutationItem[]): Promise<boolean> => {
      if (!beforeMutateWorkspaceItems) return true;
      return Promise.resolve(beforeMutateWorkspaceItems(items));
    },
    [beforeMutateWorkspaceItems]
  );

  const confirmLinkUpdateImpact = useCallback(
    async (kind: LinkUpdateImpactKind, oldPath: string, newPath: string): Promise<boolean> => {
      if (!relicClient.current || oldPath === newPath) return true;

      const result = await relicClient.current.getLinkUpdateImpact({ kind, newPath, oldPath });
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return false;
      }

      if (
        result.value.fileCount < linkUpdateImpactFileThreshold &&
        result.value.linkCount < linkUpdateImpactLinkThreshold &&
        result.value.unreadableFileCount === 0
      ) {
        return true;
      }

      const confirmKey = result.value.unreadableFileCount === 0
        ? "links.updateImpactConfirm"
        : "links.updateImpactConfirmWithUnreadableFiles";
      return window.confirm(t(confirmKey, {
        files: result.value.fileCount,
        links: result.value.linkCount,
        unreadableFiles: result.value.unreadableFileCount
      }));
    },
    [setWorkspaceError, t]
  );

  const runWorkspaceMutation = useCallback(
    async <T,>(
      items: WorkspaceMutationItem[],
      action: () => Promise<RelicResult<T>>,
      onSuccess: (value: T) => void,
      linkImpact?: LinkImpactRequest,
      options?: { skipItemGuard?: boolean }
    ): Promise<boolean> => {
      if (!options?.skipItemGuard && !await ensureCanMutateItems(items)) return false;
      if (linkImpact && !await confirmLinkUpdateImpact(linkImpact.kind, linkImpact.oldPath, linkImpact.newPath)) {
        return false;
      }

      const result = await action();
      if (result.ok) {
        onSuccess(result.value);
        return true;
      }

      setWorkspaceError(result.error.message);
      return false;
    },
    [confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError]
  );

  return { ensureCanMutateItems, runWorkspaceMutation };
}
