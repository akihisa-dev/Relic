import { useCallback, useEffect, useState } from "react";

import type {
  SearchMode,
  WorkspaceSearchResult,
  WorkspaceState,
  WorkspaceTagSummary
} from "../../shared/ipc";

interface UseWorkspaceSearchStateInput {
  setSidebarView: (view: "search") => void;
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceSearchState({
  setSidebarView,
  setWorkspaceError,
  workspaceState
}: UseWorkspaceSearchStateInput) {
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTagSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fullText");
  const [searchFrontmatterField, setSearchFrontmatterField] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [frontmatterCandidates, setFrontmatterCandidates] = useState<Record<string, string[]>>({});

  const handleTagSearch = useCallback((tag: string): void => {
    setSearchMode("tag");
    setSearchQuery(tag);
    setSidebarView("search");
  }, [setSidebarView]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setWorkspaceTags([]);
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceTags().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setWorkspaceTags(result.value);
      } else {
        setWorkspaceTags([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic || searchQuery.trim() === "") {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    let canceled = false;

    void window.relic
      .searchWorkspace({
        frontmatterField: searchMode === "frontmatter" ? searchFrontmatterField : undefined,
        mode: searchMode,
        query: searchQuery
      })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setSearchResults(result.value);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setSearchError(result.error.message);
        }
      });

    return () => {
      canceled = true;
    };
  }, [searchFrontmatterField, searchMode, searchQuery, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setFrontmatterCandidates({});
      return;
    }

    void window.relic.getFrontmatterCandidates().then((result) => {
      if (result.ok) setFrontmatterCandidates(result.value);
    });
  }, [workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  return {
    frontmatterCandidates,
    handleTagSearch,
    searchError,
    searchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery,
    workspaceTags
  };
}
