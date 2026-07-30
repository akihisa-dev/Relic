import { useCallback } from "react";

import type { LinkUpdateImpactKind } from "../../shared/ipc/files";
import type { RelicResult } from "../../shared/result";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import type { IsCurrentRequest } from "./useAsyncRequestGuard";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";
import { workspaceFileErrorMessage } from "./workspaceFileError";

export type WorkspaceMutationItem = { path: string; type: "file" | "folder" };

export interface LinkImpactRequest {
  kind: LinkUpdateImpactKind;
  newPath: string;
  oldPath: string;
}

const linkUpdateImpactFileThreshold = 30;
const linkUpdateImpactLinkThreshold = 100;

export function useWorkspaceMutationRunner({
  beginWorkspaceRequest,
  beforeMutateWorkspaceItems,
  setWorkspaceError,
  t
}: Pick<WorkspaceFileActionsContext, "beforeMutateWorkspaceItems" | "setWorkspaceError"> & Pick<
  WorkspaceRequestGuard,
  "beginWorkspaceRequest"
> & {
  t: Translator;
}) {
  const ensureCanMutateItems = useCallback(
    async (
      items: WorkspaceMutationItem[],
      isCurrentWorkspace: IsCurrentRequest = beginWorkspaceRequest()
    ): Promise<boolean> => {
      if (!isCurrentWorkspace()) return false;
      if (!beforeMutateWorkspaceItems) return true;
      const allowed = await Promise.resolve(beforeMutateWorkspaceItems(items));
      return isCurrentWorkspace() && allowed;
    },
    [beforeMutateWorkspaceItems, beginWorkspaceRequest]
  );

  const confirmLinkUpdateImpact = useCallback(
    async (
      kind: LinkUpdateImpactKind,
      oldPath: string,
      newPath: string,
      isCurrentWorkspace: IsCurrentRequest
    ): Promise<boolean> => {
      if (!relicClient.current || oldPath === newPath) return true;

      const result = await relicClient.current.getLinkUpdateImpact({ kind, newPath, oldPath });
      if (!isCurrentWorkspace()) return false;
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
      options?: {
        isCurrentWorkspace?: IsCurrentRequest;
        isComplete?: (value: T) => boolean;
        onIncomplete?: (value: T) => void;
        skipItemGuard?: boolean;
      }
    ): Promise<boolean> => {
      const isCurrentWorkspace = options?.isCurrentWorkspace ?? beginWorkspaceRequest();
      if (!isCurrentWorkspace()) return false;
      if (!options?.skipItemGuard && !await ensureCanMutateItems(items, isCurrentWorkspace)) return false;
      if (linkImpact && !await confirmLinkUpdateImpact(
        linkImpact.kind,
        linkImpact.oldPath,
        linkImpact.newPath,
        isCurrentWorkspace
      )) {
        return false;
      }
      if (!isCurrentWorkspace()) return false;

      const result = await action();
      if (!isCurrentWorkspace()) return false;
      if (result.ok) {
        if (options?.isComplete && !options.isComplete(result.value)) {
          options.onIncomplete?.(result.value);
          return false;
        }
        onSuccess(result.value);
        return true;
      }

      setWorkspaceError(workspaceFileErrorMessage(result.error, t));
      return false;
    },
    [beginWorkspaceRequest, confirmLinkUpdateImpact, ensureCanMutateItems, setWorkspaceError, t]
  );

  return { beginWorkspaceRequest, ensureCanMutateItems, runWorkspaceMutation };
}
