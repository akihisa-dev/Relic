import type { MouseEvent, ReactElement } from "react";

import type { SearchMode, WorkspaceSearchResult } from "../../shared/ipc";
import { useT } from "../i18n";

interface FilesSearchResultsProps {
  error: string | null;
  frontmatterField: string;
  isSearching: boolean;
  limitNotice: { skippedLargeFiles: number; truncated: boolean } | null;
  mode: SearchMode;
  onOpenFile: (path: string, event?: MouseEvent<HTMLButtonElement>, options?: { lineNumber?: number | null }) => void;
  openingFilePath?: string | null;
  query: string;
  results: WorkspaceSearchResult[];
}

export function FilesSearchResults({
  error,
  frontmatterField,
  isSearching,
  limitNotice,
  mode,
  onOpenFile,
  openingFilePath,
  query,
  results
}: FilesSearchResultsProps): ReactElement {
  const t = useT();

  if (error) return <div className="error-note">{error}</div>;
  if (isSearching) return <div className="list-loading-note">{t("common.loading")}</div>;
  if (mode === "frontmatter" && query.trim() !== "" && !frontmatterField.trim()) return <div className="empty-note">{t("search.noField")}</div>;

  return (
    <div className="files-search-results">
      <div className="links-panel-subheading">
        {t("files.searchResults", { count: results.length })}
      </div>
      {limitNotice ? (
        <div className="list-loading-note">
          {[
            limitNotice.truncated ? t("search.truncated") : null,
            limitNotice.skippedLargeFiles > 0 ? t("search.skippedLargeFiles", { count: limitNotice.skippedLargeFiles }) : null
          ].filter(Boolean).join(" ")}
        </div>
      ) : null}
      {results.length > 0 ? (
        <ul className="search-results">
          {results.map((result, index) => (
            <li className="search-result-item" key={`${result.path}-${result.lineNumber}-${index}`}>
              <button
                className={`search-result-button${openingFilePath === result.path ? " search-result-button--opening" : ""}`}
                onClick={(event) => onOpenFile(result.path, event, { lineNumber: result.lineNumber })}
                title={result.path}
                type="button"
              >
                <span className="search-result-title">{result.fileName}</span>
                <span className="search-result-line">
                  {result.lineNumber ? `${result.lineNumber}: ` : ""}
                  {result.lineText}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-note">{t("search.noMatches")}</div>
      )}
    </div>
  );
}
