import { useMemo } from "react";

import type { Backlink, UnlinkedReference, UnlinkedReferencesResult, WorkspaceTreeNode } from "../../shared/ipc";
import { createWikiLinkResolver, type AliasIndex, type ResolvedWikiLink } from "../../shared/links";
import {
  extractOutlineHeadings,
  getActiveFileTabInPane,
  type OutlineHeading
} from "../editorDerivedState";
import { isLargeMarkdownContent } from "../largeMarkdown";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { useBacklinksState } from "./useBacklinksState";
import { useUnlinkedReferencesState } from "./useUnlinkedReferencesState";

const maxOutgoingLinks = 1000;

interface UseActiveDocumentContextInput {
  aliasesByPath: AliasIndex;
  existingMarkdownPaths: string[];
  fileTree: WorkspaceTreeNode[] | undefined;
  focusedPane: PaneId;
  isLinksPanelActive: boolean;
  leftPane: PaneState;
  rightPane: PaneState;
  isRightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  setWorkspaceError: (message: string | null) => void;
  tabs: Record<string, Tab>;
  updateTabContent: (tabId: string, content: string) => void;
}

export function shouldExtractOutlineHeadings(
  isRightPanelOpen: boolean,
  rightPanelView: RightPanelView,
  isLargeMarkdown: boolean,
  hasActiveFile: boolean
): boolean {
  return isRightPanelOpen && rightPanelView === "outline" && hasActiveFile && !isLargeMarkdown;
}

export function useActiveDocumentContext({
  aliasesByPath,
  existingMarkdownPaths,
  fileTree,
  focusedPane,
  isLinksPanelActive,
  leftPane,
  rightPane,
  isRightPanelOpen,
  rightPanelView,
  setWorkspaceError,
  tabs,
  updateTabContent
}: UseActiveDocumentContextInput): {
  activeFileTabInFocusedPane: FileTab | null;
  applyingReferenceKey: string | null;
  backlinks: Backlink[];
  isLoadingBacklinks: boolean;
  isLoadingUnlinkedReferences: boolean;
  onApplyUnlinkedReference: (reference: UnlinkedReference) => Promise<void>;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  outgoingLinksLimited: boolean;
  unlinkedReferences: UnlinkedReferencesResult;
} {
  const activeFileTabInFocusedPane = getActiveFileTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );
  const isLargeMarkdown = activeFileTabInFocusedPane
    ? isLargeMarkdownContent(activeFileTabInFocusedPane.content)
    : false;
  const isOutlinePanelActive = shouldExtractOutlineHeadings(
    isRightPanelOpen,
    rightPanelView,
    isLargeMarkdown,
    Boolean(activeFileTabInFocusedPane)
  );

  let outlineHeadings: OutlineHeading[] = [];
  if (isOutlinePanelActive && activeFileTabInFocusedPane) {
    outlineHeadings = extractOutlineHeadings(activeFileTabInFocusedPane.content);
  }

  const wikiLinkResolver = useMemo(
    () => createWikiLinkResolver(existingMarkdownPaths, aliasesByPath),
    [aliasesByPath, existingMarkdownPaths]
  );
  const allOutgoingLinks = useMemo(
    () => activeFileTabInFocusedPane && !isLargeMarkdown && isLinksPanelActive
      ? wikiLinkResolver(activeFileTabInFocusedPane.content, activeFileTabInFocusedPane.path, { limit: maxOutgoingLinks + 1 })
      : [],
    [
      activeFileTabInFocusedPane?.content,
      activeFileTabInFocusedPane?.path,
      isLargeMarkdown,
      isLinksPanelActive,
      wikiLinkResolver
    ]
  );
  const outgoingLinksLimited = allOutgoingLinks.length > maxOutgoingLinks;
  const outgoingLinks = outgoingLinksLimited
    ? allOutgoingLinks.slice(0, maxOutgoingLinks)
    : allOutgoingLinks;

  const { backlinks, isLoadingBacklinks } = useBacklinksState({
    activeFilePath: activeFileTabInFocusedPane && !isLargeMarkdown && isLinksPanelActive ? activeFileTabInFocusedPane.path : null,
    enabled: isLinksPanelActive,
    fileTree,
    setWorkspaceError
  });
  const {
    applyingReferenceKey,
    isLoadingUnlinkedReferences,
    onApplyUnlinkedReference,
    unlinkedReferences
  } = useUnlinkedReferencesState({
    activeFilePath: activeFileTabInFocusedPane && !isLargeMarkdown && isLinksPanelActive ? activeFileTabInFocusedPane.path : null,
    enabled: isLinksPanelActive,
    fileTree,
    setWorkspaceError,
    tabs,
    updateTabContent
  });

  return {
    activeFileTabInFocusedPane,
    applyingReferenceKey,
    backlinks,
    isLoadingBacklinks,
    isLoadingUnlinkedReferences,
    onApplyUnlinkedReference,
    outlineHeadings,
    outgoingLinks,
    outgoingLinksLimited,
    unlinkedReferences
  };
}
