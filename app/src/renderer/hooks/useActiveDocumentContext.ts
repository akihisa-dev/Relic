import { useMemo } from "react";

import type { Backlink, WorkspaceTreeNode } from "../../shared/ipc";
import { resolveWikiLinks, type AliasIndex, type ResolvedWikiLink } from "../../shared/links";
import {
  extractOutlineHeadings,
  getActiveFileTabInPane,
  type OutlineHeading
} from "../editorDerivedState";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";
import { useBacklinksState } from "./useBacklinksState";

interface UseActiveDocumentContextInput {
  aliasesByPath: AliasIndex;
  existingMarkdownPaths: string[];
  fileTree: WorkspaceTreeNode[] | undefined;
  focusedPane: PaneId;
  leftPane: PaneState;
  rightPane: PaneState;
  setWorkspaceError: (message: string | null) => void;
  tabs: Record<string, Tab>;
}

export function useActiveDocumentContext({
  aliasesByPath,
  existingMarkdownPaths,
  fileTree,
  focusedPane,
  leftPane,
  rightPane,
  setWorkspaceError,
  tabs
}: UseActiveDocumentContextInput): {
  activeFilePathForGraph: string | null;
  activeFileTabInFocusedPane: FileTab | null;
  backlinks: Backlink[];
  isLoadingBacklinks: boolean;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
} {
  const activeFileTabInFocusedPane = getActiveFileTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );
  const activeFilePathForGraph = useMemo(() => {
    const paneOrder = focusedPane === "left" ? [leftPane, rightPane] : [rightPane, leftPane];
    for (const pane of paneOrder) {
      for (const tabId of [...pane.history].reverse()) {
        const tab = tabs[tabId];
        if (tab?.kind === "file") return tab.path;
      }
    }
    for (const tab of Object.values(tabs)) {
      if (tab.kind === "file") return tab.path;
    }
    return null;
  }, [focusedPane, leftPane, rightPane, tabs]);
  const outlineHeadings = activeFileTabInFocusedPane
    ? extractOutlineHeadings(activeFileTabInFocusedPane.content)
    : [];
  const outgoingLinks = activeFileTabInFocusedPane
    ? resolveWikiLinks(activeFileTabInFocusedPane.content, activeFileTabInFocusedPane.path, existingMarkdownPaths, aliasesByPath)
    : [];

  const { backlinks, isLoadingBacklinks } = useBacklinksState({
    activeFilePath: activeFileTabInFocusedPane?.path ?? null,
    fileTree,
    setWorkspaceError
  });

  return {
    activeFilePathForGraph,
    activeFileTabInFocusedPane,
    backlinks,
    isLoadingBacklinks,
    outlineHeadings,
    outgoingLinks
  };
}
