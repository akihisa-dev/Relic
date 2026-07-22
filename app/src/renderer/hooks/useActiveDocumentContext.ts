import { useMemo, useRef } from "react";

import type { Backlink, UnlinkedReference, UnlinkedReferencesResult, WorkspaceTreeNode } from "../../shared/ipc";
import { createWikiLinkResolver, type AliasIndex, type ResolvedWikiLink } from "../../shared/links";
import {
  getActiveFileTabInPane,
  updateOutlineSnapshot,
  type OutlineSnapshot,
  type OutlineHeading
} from "../editorDerivedState";
import { isLargeMarkdownContent } from "../largeMarkdown";
import {
  updateOutgoingLinksSnapshot,
  type OutgoingLinksSnapshot
} from "../editorOutgoingLinks";
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

  const outlineSnapshotRef = useRef<{ path: string; snapshot: OutlineSnapshot } | null>(null);

  let outlineHeadings: OutlineHeading[] = [];
  if (isOutlinePanelActive && activeFileTabInFocusedPane) {
    const previous = outlineSnapshotRef.current?.path === activeFileTabInFocusedPane.path
      ? outlineSnapshotRef.current.snapshot
      : null;
    const snapshot = updateOutlineSnapshot(
      previous,
      activeFileTabInFocusedPane.content,
      activeFileTabInFocusedPane.contentRevision ?? 0,
      activeFileTabInFocusedPane.contentUpdate
    );
    outlineSnapshotRef.current = { path: activeFileTabInFocusedPane.path, snapshot };
    outlineHeadings = snapshot.headings;
  }

  const wikiLinkResolver = useMemo(
    () => createWikiLinkResolver(existingMarkdownPaths, aliasesByPath),
    [aliasesByPath, existingMarkdownPaths]
  );
  const outgoingLinksSnapshotRef = useRef<OutgoingLinksSnapshot | null>(null);
  const allOutgoingLinks = activeFileTabInFocusedPane && !isLargeMarkdown && isLinksPanelActive
    ? updateOutgoingLinksSnapshot(
      outgoingLinksSnapshotRef.current,
      activeFileTabInFocusedPane.content,
      activeFileTabInFocusedPane.contentRevision ?? 0,
      activeFileTabInFocusedPane.contentUpdate,
      activeFileTabInFocusedPane.path,
      wikiLinkResolver,
      maxOutgoingLinks + 1
    )
    : null;
  if (allOutgoingLinks) outgoingLinksSnapshotRef.current = allOutgoingLinks;
  const resolvedOutgoingLinks = allOutgoingLinks?.links ?? [];
  const outgoingLinksLimited = resolvedOutgoingLinks.length > maxOutgoingLinks;
  const outgoingLinks = outgoingLinksLimited
    ? resolvedOutgoingLinks.slice(0, maxOutgoingLinks)
    : resolvedOutgoingLinks;

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
