import type { Backlink, WorkspaceTreeNode } from "../../shared/ipc";
import { resolveWikiLinks, type AliasIndex, type ResolvedWikiLink } from "../../shared/links";
import {
  extractOutlineHeadings,
  getActiveFileTabInPane,
  type OutlineHeading
} from "../editorDerivedState";
import { isLargeMarkdownContent } from "../largeMarkdown";
import type { FileTab, PaneId, PaneState, Tab } from "../store/editorStore";
import { useBacklinksState } from "./useBacklinksState";

const maxOutgoingLinks = 1000;

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
  activeFileTabInFocusedPane: FileTab | null;
  backlinks: Backlink[];
  isLoadingBacklinks: boolean;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  outgoingLinksLimited: boolean;
} {
  const activeFileTabInFocusedPane = getActiveFileTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );
  const isLargeMarkdown = activeFileTabInFocusedPane
    ? isLargeMarkdownContent(activeFileTabInFocusedPane.content)
    : false;
  const outlineHeadings = activeFileTabInFocusedPane && !isLargeMarkdown
    ? extractOutlineHeadings(activeFileTabInFocusedPane.content)
    : [];
  const allOutgoingLinks = activeFileTabInFocusedPane && !isLargeMarkdown
    ? resolveWikiLinks(activeFileTabInFocusedPane.content, activeFileTabInFocusedPane.path, existingMarkdownPaths, aliasesByPath)
    : [];
  const outgoingLinksLimited = allOutgoingLinks.length > maxOutgoingLinks;
  const outgoingLinks = outgoingLinksLimited
    ? allOutgoingLinks.slice(0, maxOutgoingLinks)
    : allOutgoingLinks;

  const { backlinks, isLoadingBacklinks } = useBacklinksState({
    activeFilePath: activeFileTabInFocusedPane && !isLargeMarkdown ? activeFileTabInFocusedPane.path : null,
    fileTree,
    setWorkspaceError
  });

  return {
    activeFileTabInFocusedPane,
    backlinks,
    isLoadingBacklinks,
    outlineHeadings,
    outgoingLinks,
    outgoingLinksLimited
  };
}
