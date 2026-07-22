import { useMemo } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import {
  registeredWorkspacesForState
} from "../appShellModel";
import { editorTabIndex } from "../editorTabIndexes";
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
  const tabIndex = editorTabIndex(tabs);
  const dirtyMarkdownPaths = tabIndex.dirtyMarkdownPaths;
  const registeredWorkspaces = useMemo(
    () => registeredWorkspacesForState(workspaceState),
    [workspaceState]
  );
  const openFilePathSet = tabIndex.openFilePathSet;

  return {
    dirtyMarkdownPaths,
    existingMarkdownPaths,
    openFilePathSet,
    registeredWorkspaces
  };
}
