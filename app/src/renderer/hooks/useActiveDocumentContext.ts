import type { Backlink, CardbookTreeNode } from "../../shared/ipc";
import { resolveWikiLinks, type AliasIndex, type ResolvedWikiLink } from "../../shared/links";
import {
  extractOutlineHeadings,
  getActiveCardTabInPane,
  type OutlineHeading
} from "../editorDerivedState";
import type { CardTab, PaneId, PaneState, Tab } from "../store/editorStore";
import { useBacklinksState } from "./useBacklinksState";

interface UseActiveDocumentContextInput {
  aliasesByPath: AliasIndex;
  existingMarkdownPaths: string[];
  cardTree: CardbookTreeNode[] | undefined;
  focusedPane: PaneId;
  leftPane: PaneState;
  rightPane: PaneState;
  setCardbookError: (message: string | null) => void;
  tabs: Record<string, Tab>;
}

export function useActiveDocumentContext({
  aliasesByPath,
  existingMarkdownPaths,
  cardTree,
  focusedPane,
  leftPane,
  rightPane,
  setCardbookError,
  tabs
}: UseActiveDocumentContextInput): {
  activeCardTabInFocusedPane: CardTab | null;
  backlinks: Backlink[];
  isLoadingBacklinks: boolean;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
} {
  const activeCardTabInFocusedPane = getActiveCardTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );
  const outlineHeadings = activeCardTabInFocusedPane
    ? extractOutlineHeadings(activeCardTabInFocusedPane.content)
    : [];
  const outgoingLinks = activeCardTabInFocusedPane
    ? resolveWikiLinks(activeCardTabInFocusedPane.content, activeCardTabInFocusedPane.path, existingMarkdownPaths, aliasesByPath)
    : [];

  const { backlinks, isLoadingBacklinks } = useBacklinksState({
    activeCardPath: activeCardTabInFocusedPane?.path ?? null,
    cardTree,
    setCardbookError
  });

  return {
    activeCardTabInFocusedPane,
    backlinks,
    isLoadingBacklinks,
    outlineHeadings,
    outgoingLinks
  };
}
