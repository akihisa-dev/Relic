import { useMemo } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import {
  openFilePathsForTabs,
  registeredWorkspacesForState
} from "../appShellModel";
import type { Tab } from "../store/editorStore";
import { collectMarkdownPaths } from "../workspacePaths";

export function useAppWorkspaceCollections({
  tabs,
  workspaceState
}: {
  tabs: Record<string, Tab>;
  workspaceState: WorkspaceState | null;
}): {
  dirtyMarkdownPaths: string[];
  existingMarkdownPaths: string[];
  openFilePathSet: Set<string>;
  registeredWorkspaces: ReturnType<typeof registeredWorkspacesForState>;
} {
  const existingMarkdownPaths = useMemo(
    () => collectMarkdownPaths(workspaceState?.fileTree ?? []),
    [workspaceState?.fileTree]
  );
  const dirtyMarkdownPaths = useMemo(
    () => Object.values(tabs).flatMap((tab) => {
      if (tab.kind !== "file") return [];
      return tab.content !== tab.savedContent || Boolean(tab.externalConflict) ? [tab.path] : [];
    }),
    [tabs]
  );
  const registeredWorkspaces = useMemo(
    () => registeredWorkspacesForState(workspaceState),
    [workspaceState]
  );
  const openFilePathSet = useMemo(
    () => openFilePathsForTabs(tabs),
    [tabs]
  );

  return {
    dirtyMarkdownPaths,
    existingMarkdownPaths,
    openFilePathSet,
    registeredWorkspaces
  };
}
