import { relicClient } from "../relicClient";
import { useCallback, useEffect, useState } from "react";

import type { FrontmatterCategoryChoice, WorkspaceState } from "../../shared/ipc";
import { uniqueChoices } from "../frontmatterSettingsModel";

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
  const [categoryChoices, setCategoryChoices] = useState<FrontmatterCategoryChoice[]>([]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !relicClient.current) {
      setCategoryChoices([]);
      return;
    }

    let canceled = false;

    void relicClient.current.getWorkspaceFrontmatterCategoryChoices().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setCategoryChoices(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id]);

  const handleSaveCategoryChoices = useCallback((choices: FrontmatterCategoryChoice[]): void => {
    const normalizedChoices = uniqueChoices(choices.flatMap((choice) => {
      const normalizedChoice = choice.trim();
      return normalizedChoice ? [normalizedChoice] : [];
    }));
    setCategoryChoices(normalizedChoices);
    void relicClient.current?.saveWorkspaceFrontmatterCategoryChoices(normalizedChoices).then((result) => {
      if (result.ok) {
        setCategoryChoices(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError]);

  return {
    categoryChoices: workspaceState?.activeWorkspace ? categoryChoices : [],
    handleSaveCategoryChoices
  };
}
