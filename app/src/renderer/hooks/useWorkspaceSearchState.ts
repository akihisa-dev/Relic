import { useEffect, useMemo, useState } from "react";

import type {
  SearchMode,
  SearchWorkspaceInput,
  UserDefinedField,
  WorkspaceSearchResult,
  WorkspaceState
} from "../../shared/ipc";
import { fixedStatusValues } from "../../shared/status";
import { knownFrontmatterSearchFields } from "../filesSidebarModel";

interface UseWorkspaceSearchStateInput {
  setWorkspaceError: (message: string | null) => void;
  userDefinedFields: UserDefinedField[];
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceSearchState({
  setWorkspaceError,
  userDefinedFields,
  workspaceState
}: UseWorkspaceSearchStateInput) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fullText");
  const [searchFrontmatterField, setSearchFrontmatterField] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [workspaceFrontmatterCandidates, setWorkspaceFrontmatterCandidates] = useState<Record<string, string[]>>({});
  const frontmatterSearchFields = useMemo(
    () => knownFrontmatterSearchFields(userDefinedFields),
    [userDefinedFields]
  );
  const frontmatterCandidates = useMemo(() => {
    const result: Record<string, string[]> = { ...workspaceFrontmatterCandidates };
    result.status = [...fixedStatusValues];

    for (const field of userDefinedFields) {
      result[field.name] = mergeCandidates(result[field.name] ?? [], field.choices ?? []);
    }

    return result;
  }, [userDefinedFields, workspaceFrontmatterCandidates]);

  useEffect(() => {
    if (
      searchMode === "frontmatter" &&
      searchFrontmatterField !== "" &&
      !frontmatterSearchFields.includes(searchFrontmatterField)
    ) {
      setSearchFrontmatterField("");
    }
  }, [frontmatterSearchFields, searchFrontmatterField, searchMode]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setWorkspaceFrontmatterCandidates({});
      return;
    }

    let canceled = false;

    void window.relic.getFrontmatterValueCandidates().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setWorkspaceFrontmatterCandidates(result.value);
      } else {
        setWorkspaceFrontmatterCandidates({});
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
      setIsSearching(false);
      return;
    }

    let canceled = false;
    const input: SearchWorkspaceInput =
      searchMode === "frontmatter"
        ? { frontmatterField: searchFrontmatterField, mode: searchMode, query: searchQuery }
        : { mode: searchMode, query: searchQuery };

    setIsSearching(true);
    void window.relic
      .searchWorkspace(input)
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setSearchResults(result.value);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setSearchError(result.error.message);
        }
      })
      .finally(() => {
        if (!canceled) setIsSearching(false);
      });

    return () => {
      canceled = true;
    };
  }, [searchFrontmatterField, searchMode, searchQuery, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  return {
    frontmatterCandidates,
    frontmatterSearchFields,
    isSearching,
    searchError,
    searchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery
  };
}

function mergeCandidates(...lists: string[][]): string[] {
  return [...new Set(lists.flat().filter((item) => item.trim() !== ""))]
    .sort((a, b) => a.localeCompare(b, "ja"));
}
