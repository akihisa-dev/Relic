import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import type { FrontmatterCategoryChoice, WorkspaceState } from "../../shared/ipc";
import { uniqueChoices } from "../frontmatterSettingsModel";
import { useAsyncRequestGuard } from "./useAsyncRequestGuard";

interface UseWorkspaceFrontmatterCategoryChoicesInput {
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceFrontmatterCategoryChoices({
  setWorkspaceError,
  workspaceState
}: UseWorkspaceFrontmatterCategoryChoicesInput): {
  categoryChoices: FrontmatterCategoryChoice[];
  handleSaveCategoryChoices: (choices: FrontmatterCategoryChoice[]) => void;
} {
  const workspaceId = workspaceState?.activeWorkspace?.id ?? null;
  const [snapshot, setSnapshot] = useState<{
    choices: FrontmatterCategoryChoice[];
    workspaceId: string;
  } | null>(null);
  const beginRequest = useAsyncRequestGuard([workspaceId]);

  useEffect(() => {
    const client = relicClient.current;
    if (!workspaceId || !client) {
      return;
    }

    const isCurrentRequest = beginRequest();

    void client.getWorkspaceFrontmatterCategoryChoices().then((result) => {
      if (!isCurrentRequest()) return;

      if (result.ok) {
        setSnapshot({ choices: result.value, workspaceId });
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [beginRequest, setWorkspaceError, workspaceId]);

  const handleSaveCategoryChoices = useCallback((choices: FrontmatterCategoryChoice[]): void => {
    const normalizedChoices = uniqueChoices(choices.flatMap((choice) => {
      const normalizedChoice = choice.trim();
      return normalizedChoice ? [normalizedChoice] : [];
    }));
    const client = relicClient.current;
    if (!workspaceId || !client) return;
    const isCurrentRequest = beginRequest();
    setSnapshot({ choices: normalizedChoices, workspaceId });
    void client.saveWorkspaceFrontmatterCategoryChoices(normalizedChoices).then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) {
        setSnapshot({ choices: result.value, workspaceId });
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [beginRequest, setWorkspaceError, workspaceId]);

  return {
    categoryChoices: workspaceId && snapshot?.workspaceId === workspaceId ? snapshot.choices : [],
    handleSaveCategoryChoices
  };
}
