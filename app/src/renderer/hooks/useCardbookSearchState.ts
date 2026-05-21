import { useEffect, useMemo, useState } from "react";

import type {
  SearchMode,
  SearchCardbookInput,
  UserDefinedField,
  CardbookSearchResult,
  CardbookState
} from "../../shared/ipc";
import { fixedStatusValues } from "../../shared/status";
import { knownFrontmatterSearchFields } from "../cardsSidebarModel";

interface UseCardbookSearchStateInput {
  setCardbookError: (message: string | null) => void;
  userDefinedFields: UserDefinedField[];
  cardbookState: CardbookState | null;
}

export function useCardbookSearchState({
  setCardbookError,
  userDefinedFields,
  cardbookState
}: UseCardbookSearchStateInput) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fullText");
  const [searchFrontmatterField, setSearchFrontmatterField] = useState("");
  const [searchResults, setSearchResults] = useState<CardbookSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [cardbookFrontmatterCandidates, setCardbookFrontmatterCandidates] = useState<Record<string, string[]>>({});
  const frontmatterSearchFields = useMemo(
    () => knownFrontmatterSearchFields(userDefinedFields),
    [userDefinedFields]
  );
  const frontmatterCandidates = useMemo(() => {
    const result: Record<string, string[]> = { ...cardbookFrontmatterCandidates };
    result.status = [...fixedStatusValues];

    for (const field of userDefinedFields) {
      result[field.name] = mergeCandidates(result[field.name] ?? [], field.choices ?? []);
    }

    return result;
  }, [userDefinedFields, cardbookFrontmatterCandidates]);

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
    if (!cardbookState?.activeCardbook || !window.relic) {
      setCardbookFrontmatterCandidates({});
      return;
    }

    let canceled = false;

    void window.relic.getFrontmatterValueCandidates().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setCardbookFrontmatterCandidates(result.value);
      } else {
        setCardbookFrontmatterCandidates({});
        setCardbookError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setCardbookError, cardbookState?.activeCardbook?.id, cardbookState?.cardTree]);

  useEffect(() => {
    if (!cardbookState?.activeCardbook || !window.relic || searchQuery.trim() === "") {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let canceled = false;
    const input: SearchCardbookInput =
      searchMode === "frontmatter"
        ? { frontmatterField: searchFrontmatterField, mode: searchMode, query: searchQuery }
        : { mode: searchMode, query: searchQuery };

    setIsSearching(true);
    void window.relic
      .searchCardbook(input)
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
  }, [searchFrontmatterField, searchMode, searchQuery, cardbookState?.activeCardbook?.id, cardbookState?.cardTree]);

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
