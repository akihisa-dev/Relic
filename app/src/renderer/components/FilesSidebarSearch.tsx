import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { SearchMode } from "../../shared/ipc";
import {
  activeFileSearchModeLabel,
  fileSearchModeOptions,
  frontmatterValueCandidatesForField
} from "../filesSidebarModel";
import { useT } from "../i18n";

interface FilesSidebarSearchProps {
  onSearchFrontmatterFieldChange: (field: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchQueryChange: (query: string) => void;
  searchError: string | null;
  searchFocusRequest: number;
  searchFrontmatterCandidates: Record<string, string[]>;
  searchFrontmatterField: string;
  searchFrontmatterFields: string[];
  searchMode: SearchMode;
  searchQuery: string;
}

export function FilesSidebarSearch({
  onSearchFrontmatterFieldChange,
  onSearchModeChange,
  onSearchQueryChange,
  searchError,
  searchFocusRequest,
  searchFrontmatterCandidates,
  searchFrontmatterField,
  searchFrontmatterFields,
  searchMode,
  searchQuery
}: FilesSidebarSearchProps): ReactElement {
  const [isSearchMethodMenuOpen, setIsSearchMethodMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchShellRef = useRef<HTMLDivElement | null>(null);
  const t = useT();
  const frontmatterValueCandidates = useMemo(
    () => frontmatterValueCandidatesForField(searchFrontmatterCandidates, searchFrontmatterField),
    [searchFrontmatterCandidates, searchFrontmatterField]
  );
  const searchModeOptions = useMemo(() => fileSearchModeOptions(t), [t]);
  const activeSearchModeLabel = activeFileSearchModeLabel(
    searchModeOptions,
    searchMode,
    t("files.searchModeFullText")
  );
  const searchPlaceholder = t("files.searchPlaceholder", { mode: activeSearchModeLabel });

  useEffect(() => {
    if (searchFocusRequest <= 0) return;
    searchInputRef.current?.focus();
  }, [searchFocusRequest]);

  useEffect(() => {
    if (!isSearchMethodMenuOpen) return;

    const close = (event: globalThis.PointerEvent): void => {
      if (searchShellRef.current?.contains(event.target as Node)) return;
      setIsSearchMethodMenuOpen(false);
    };

    window.addEventListener("pointerdown", close);

    return () => window.removeEventListener("pointerdown", close);
  }, [isSearchMethodMenuOpen]);

  return (
    <div className="files-search" ref={searchShellRef}>
      <label className={`files-search-input${searchError ? " files-search-input--error" : ""}`}>
        <button
          aria-label={t("files.searchMethod")}
          className="files-search-mode-button"
          onClick={() => setIsSearchMethodMenuOpen((current) => !current)}
          type="button"
        >
          {activeSearchModeLabel}
        </button>
        <input
          aria-label={t("files.search")}
          list={searchMode === "frontmatter" && frontmatterValueCandidates.length > 0 ? "files-search-frontmatter-values" : undefined}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          ref={searchInputRef}
          type="search"
          value={searchQuery}
        />
      </label>
      {isSearchMethodMenuOpen ? (
        <div className="files-search-method-menu" role="menu" aria-label={t("files.searchMethod")}>
          {searchModeOptions.map((option) => (
            <button
              aria-selected={option.mode === searchMode}
              className={`files-search-method${option.mode === searchMode ? " active" : ""}`}
              key={option.mode}
              onClick={() => {
                onSearchModeChange(option.mode);
                setIsSearchMethodMenuOpen(false);
                window.setTimeout(() => searchInputRef.current?.focus(), 0);
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {searchMode === "frontmatter" ? (
        <div className="files-search-frontmatter">
          <select
            aria-label={t("files.searchFrontmatterField")}
            className="search-input"
            onChange={(event) => onSearchFrontmatterFieldChange(event.target.value)}
            value={searchFrontmatterField}
          >
            <option value="">{t("files.searchFrontmatterField")}</option>
            {searchFrontmatterFields.map((field) => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
          {frontmatterValueCandidates.length > 0 ? (
            <datalist id="files-search-frontmatter-values">
              {frontmatterValueCandidates.map((candidate) => (
                <option key={candidate} value={candidate}>{candidate}</option>
              ))}
            </datalist>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
