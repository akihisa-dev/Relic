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
  const dirtyTabsKey = Object.values(tabs).flatMap((tab) => tab.kind === "file"
    ? [`${tab.id}:${tab.path}:${tab.content !== tab.savedContent || Boolean(tab.externalConflict) ? "dirty" : "saved"}`]
    : []).join("\u0000");
  const dirtyMarkdownPaths = useMemo(
    () => Object.values(tabs).flatMap((tab) => {
      if (tab.kind !== "file") return [];
      return tab.content !== tab.savedContent || Boolean(tab.externalConflict) ? [tab.path] : [];
    }),
    // The key excludes content after a tab is already dirty, so typing does not rebuild the collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dirtyTabsKey]
  );
  const registeredWorkspaces = useMemo(
    () => registeredWorkspacesForState(workspaceState),
    [workspaceState]
  );
  const openFileTabsKey = Object.values(tabs).flatMap((tab) => tab.kind === "file"
    ? [`${tab.id}:${tab.path}`]
    : []).join("\u0000");
  const openFilePathSet = useMemo(
    () => openFilePathsForTabs(tabs),
    // File content is intentionally excluded from this derived collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openFileTabsKey]
  );

  return {
    dirtyMarkdownPaths,
    existingMarkdownPaths,
    openFilePathSet,
    registeredWorkspaces
  };
}
