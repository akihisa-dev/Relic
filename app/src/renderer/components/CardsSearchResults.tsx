import type { MouseEvent, ReactElement } from "react";

import type { SearchMode, CardbookSearchResult } from "../../shared/ipc";
import { useT } from "../i18n";

interface CardsSearchResultsProps {
  error: string | null;
  frontmatterField: string;
  isSearching: boolean;
  mode: SearchMode;
  onOpenCard: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
  query: string;
  results: CardbookSearchResult[];
}

export function CardsSearchResults({
  error,
  frontmatterField,
  isSearching,
  mode,
  onOpenCard,
  query,
  results
}: CardsSearchResultsProps): ReactElement {
  const t = useT();

  if (error) return <div className="error-note">{error}</div>;
  if (isSearching) return <div className="list-loading-note">{t("common.loading")}</div>;
  if (mode === "frontmatter" && query.trim() !== "" && !frontmatterField.trim()) return <div className="empty-note">{t("search.noField")}</div>;

  return (
    <div className="cards-search-results">
      <div className="links-panel-subheading">
        {t("cards.searchResults", { count: results.length })}
      </div>
      {results.length > 0 ? (
        <ul className="search-results">
          {results.map((result, index) => (
            <li className="search-result-item" key={`${result.path}-${result.lineNumber}-${index}`}>
              <button
                className="search-result-button"
                onClick={(event) => onOpenCard(result.path, event)}
                title={result.path}
                type="button"
              >
                <span className="search-result-title">{result.cardName}</span>
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
