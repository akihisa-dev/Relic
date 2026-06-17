import { useEffect, useMemo, useRef, useState } from "react";

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

interface SearchSnapshot {
  error: string | null;
  key: string | null;
  limitNotice: { skippedLargeFiles: number; skippedLongLines: number; truncated: boolean } | null;
  results: WorkspaceSearchResult[];
}

const emptySearchSnapshot: SearchSnapshot = {
  error: null,
  key: null,
  limitNotice: null,
  results: []
};

export function useWorkspaceSearchState({
  setWorkspaceError,
  userDefinedFields,
  workspaceState
}: UseWorkspaceSearchStateInput) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fullText");
  const [searchFrontmatterField, setSearchFrontmatterField] = useState("");
  const [searchSnapshot, setSearchSnapshot] = useState<SearchSnapshot>(emptySearchSnapshot);
  const [workspaceFrontmatterCandidates, setWorkspaceFrontmatterCandidates] = useState<Record<string, string[]>>({});
  const [debouncedSearchKey, setDebouncedSearchKey] = useState<string | null>(null);
  const [debouncedSearchMode, setDebouncedSearchMode] = useState<SearchMode>("fullText");
  const [debouncedSearchFrontmatterField, setDebouncedSearchFrontmatterField] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const lastRequestedSearchKey = useRef<string | null>(null);
  const frontmatterSearchFields = useMemo(
    () => knownFrontmatterSearchFields(userDefinedFields),
    [userDefinedFields]
  );
  const effectiveSearchFrontmatterField =
    searchMode === "frontmatter" &&
    searchFrontmatterField !== "" &&
    !frontmatterSearchFields.includes(searchFrontmatterField)
      ? ""
      : searchFrontmatterField;
  const hasActiveWorkspace = Boolean(workspaceState?.activeWorkspace);
  const searchKey = hasActiveWorkspace && searchQuery.trim() !== ""
    ? `${workspaceState?.activeWorkspace?.id ?? ""}:${searchMode}:${effectiveSearchFrontmatterField}:${searchQuery}`
    : null;
  const frontmatterCandidates = useMemo(() => {
    const result: Record<string, string[]> = hasActiveWorkspace ? { ...workspaceFrontmatterCandidates } : {};
    result.status = [...fixedStatusValues];

    for (const field of userDefinedFields) {
      result[field.name] = mergeCandidates(result[field.name] ?? [], field.choices ?? []);
    }

    return result;
  }, [hasActiveWorkspace, userDefinedFields, workspaceFrontmatterCandidates]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
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
    if (!hasActiveWorkspace || searchQuery.trim() === "") {
      setDebouncedSearchKey(null);
      return;
    }

    const nextSearchKey = searchKey;
    const timer = window.setTimeout(() => {
      setDebouncedSearchKey(nextSearchKey);
      setDebouncedSearchMode(searchMode);
      setDebouncedSearchFrontmatterField(effectiveSearchFrontmatterField);
      setDebouncedSearchQuery(searchQuery);
      lastRequestedSearchKey.current = null;
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [effectiveSearchFrontmatterField, hasActiveWorkspace, searchKey, searchMode, searchQuery]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic || debouncedSearchKey === null) {
      return;
    }
    if (lastRequestedSearchKey.current === debouncedSearchKey) {
      return;
    }

    let canceled = false;
    const input: SearchWorkspaceInput =
      debouncedSearchMode === "frontmatter"
        ? {
          frontmatterField: debouncedSearchFrontmatterField,
          mode: debouncedSearchMode,
          query: debouncedSearchQuery
        }
        : {
          mode: debouncedSearchMode,
          query: debouncedSearchQuery
        };

    lastRequestedSearchKey.current = debouncedSearchKey;

    void window.relic
      .searchWorkspace(input)
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setSearchSnapshot({
            error: null,
            key: debouncedSearchKey,
            limitNotice: result.value.truncated || result.value.skippedLargeFiles > 0 || result.value.skippedLongLines > 0
              ? {
                skippedLargeFiles: result.value.skippedLargeFiles,
                skippedLongLines: result.value.skippedLongLines,
                truncated: result.value.truncated
              }
              : null,
            results: result.value.results
          });
        } else {
          setSearchSnapshot({
            error: result.error.message,
            key: debouncedSearchKey,
            limitNotice: null,
            results: []
          });
        }
      });

    return () => {
      canceled = true;
    };
  }, [
    debouncedSearchKey,
    debouncedSearchMode,
    debouncedSearchFrontmatterField,
    debouncedSearchQuery,
    workspaceState?.activeWorkspace?.id,
    workspaceState?.fileTree
  ]);

  const hasActiveSearch = searchKey !== null;
  const currentSearchSnapshot = hasActiveSearch && searchSnapshot.key === searchKey ? searchSnapshot : emptySearchSnapshot;

  return {
    frontmatterCandidates,
    frontmatterSearchFields,
    isSearching: hasActiveSearch && searchSnapshot.key !== searchKey,
    searchError: currentSearchSnapshot.error,
    searchLimitNotice: currentSearchSnapshot.limitNotice,
    searchFrontmatterField: effectiveSearchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults: currentSearchSnapshot.results,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery
  };
}


function mergeCandidates(...lists: string[][]): string[] {
  return Array.from(new Set(lists.flat().filter((item) => item.trim() !== "")))
    .toSorted((a, b) => a.localeCompare(b, "ja"));
}
