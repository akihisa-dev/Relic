import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { SearchAndReplaceMatch, SearchMode, WorkspaceSearchResult, WorkspaceTagSummary } from "../../shared/ipc";
import { useT } from "../i18n";

export function SearchSidebar({
  activeFilePath,
  error,
  frontmatterCandidates,
  frontmatterField,
  mode,
  query,
  results,
  tags,
  onFrontmatterFieldChange,
  onModeChange,
  onOpenFile,
  onQueryChange,
  onTagSelect,
  onWorkspaceChange
}: {
  activeFilePath: string | null;
  error: string | null;
  frontmatterCandidates: Record<string, string[]>;
  frontmatterField: string;
  mode: SearchMode;
  query: string;
  results: WorkspaceSearchResult[];
  tags: WorkspaceTagSummary[];
  onFrontmatterFieldChange: (field: string) => void;
  onModeChange: (mode: SearchMode) => void;
  onOpenFile: (path: string) => void;
  onQueryChange: (query: string) => void;
  onTagSelect: (tag: string) => void;
  onWorkspaceChange: () => void;
}): ReactElement {
  const [replaceQuery, setReplaceQuery] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [replaceIsRegex, setReplaceIsRegex] = useState(false);
  const [replacePreview, setReplacePreview] = useState<SearchAndReplaceMatch[] | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replaceStatus, setReplaceStatus] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const knownFrontmatterFields = useMemo(
    () =>
      Array.from(
        new Set([
          "tags",
          "aliases",
          "date",
          "status",
          "publish",
          "url",
          "author",
          ...Object.keys(frontmatterCandidates)
        ])
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [frontmatterCandidates]
  );
  const frontmatterValueCandidates = frontmatterField ? (frontmatterCandidates[frontmatterField] ?? []) : [];
  const t = useT();

  const handleReplaceInFile = (): void => {
    if (!activeFilePath || !window.relic) return;
    setReplaceError(null);
    setReplaceStatus(null);
    setIsReplacing(true);

    void window.relic
      .replaceInFile({
        isRegex: replaceIsRegex,
        path: activeFilePath,
        replacement: replacementText,
        searchQuery: replaceQuery
      })
      .then((result) => {
        if (result.ok) {
          setReplaceStatus(t("search.replaceDone", { count: result.value.count }));
          onWorkspaceChange();
        } else {
          setReplaceError(result.error.message);
        }
      })
      .finally(() => setIsReplacing(false));
  };

  const handlePreviewBulkReplace = (): void => {
    if (!window.relic) return;
    setReplaceError(null);
    setReplaceStatus(null);
    setReplacePreview(null);
    setIsReplacing(true);

    void window.relic
      .searchAndReplace({
        isRegex: replaceIsRegex,
        replacement: replacementText,
        searchQuery: replaceQuery
      })
      .then((result) => {
        if (result.ok) {
          setReplacePreview(result.value);
        } else {
          setReplaceError(result.error.message);
        }
      })
      .finally(() => setIsReplacing(false));
  };

  const handleApplyBulkReplace = (): void => {
    if (!window.relic) return;
    setReplaceError(null);
    setIsReplacing(true);

    void window.relic
      .applySearchAndReplace({
        isRegex: replaceIsRegex,
        replacement: replacementText,
        searchQuery: replaceQuery
      })
      .then((result) => {
        if (result.ok) {
          setReplacePreview(null);
          setReplaceStatus(`${result.value.count} 件を一括置換しました。`);
          onWorkspaceChange();
        } else {
          setReplaceError(result.error.message);
        }
      })
      .finally(() => setIsReplacing(false));
  };

  return (
    <div className="sidebar-section">
      <input
        aria-label={t("search.search")}
        className={`search-input${error ? " search-input--error" : ""}`}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={mode === "frontmatter" ? "Value" : t("search.search")}
        value={query}
        list={mode === "frontmatter" && frontmatterValueCandidates.length > 0 ? "search-frontmatter-values" : undefined}
      />
      <select
        aria-label={t("search.mode")}
        className="search-mode-select"
        onChange={(event) => onModeChange(event.target.value as SearchMode)}
        value={mode}
      >
        <option value="fullText">{t("search.all")}</option>
        <option value="fileName">{t("search.fileName")}</option>
        <option value="tag">Tag</option>
        <option value="regex">{t("search.regex")}</option>
        <option value="frontmatter">{t("search.frontmatter")}</option>
      </select>
      {mode === "frontmatter" ? (
        <div className="search-frontmatter-fields">
          <input
            aria-label={t("search.frontmatterField")}
            className="search-input"
            list="search-frontmatter-fields"
            onChange={(event) => onFrontmatterFieldChange(event.target.value)}
            placeholder={t("search.fieldName")}
            value={frontmatterField}
          />
          <datalist id="search-frontmatter-fields">
            {knownFrontmatterFields.map((field) => (
              <option key={field} value={field} />
            ))}
          </datalist>
          {frontmatterValueCandidates.length > 0 ? (
            <datalist id="search-frontmatter-values">
              {frontmatterValueCandidates.map((candidate) => (
                <option key={candidate} value={candidate} />
              ))}
            </datalist>
          ) : null}
        </div>
      ) : null}
      {mode === "regex" ? (
        <div className="search-patterns">
          {[
            [t("search.patternHeading"), "^#+ "],
            [t("search.patternUrl"), "https?://"],
            [t("search.patternDate"), "\\d{4}-\\d{2}-\\d{2}"],
            [t("search.patternTag"), "#\\w+"]
          ].map(([label, pattern]) => (
            <button
              className="search-pattern-btn"
              key={label}
              onClick={() => onQueryChange(pattern)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <div className="error-note">{error}</div> : null}
      <div className="search-block">
        <div className="links-panel-subheading">{t("search.results")}</div>
        {results.length > 0 ? (
          <ul className="search-results">
            {results.map((result, index) => (
              <li className="search-result-item" key={`${result.path}-${result.lineNumber}-${index}`}>
                <button
                  className="search-result-button"
                  onClick={() => onOpenFile(result.path)}
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
        ) : mode === "frontmatter" && !frontmatterField.trim() ? (
          <div className="empty-note">{t("search.noField")}</div>
        ) : query.trim() ? (
          <div className="empty-note">{t("search.noMatches")}</div>
        ) : (
          <div className="empty-note">{t("search.noResults")}</div>
        )}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("search.replace")}</div>
        <input
          aria-label={t("search.replaceQuery")}
          className={`search-input${replaceError ? " search-input--error" : ""}`}
          onChange={(e) => { setReplaceQuery(e.target.value); setReplacePreview(null); setReplaceStatus(null); }}
          placeholder={t("search.replaceQuery")}
          value={replaceQuery}
        />
        <input
          aria-label={t("search.replaceAfter")}
          className="search-input"
          onChange={(e) => { setReplacementText(e.target.value); setReplacePreview(null); setReplaceStatus(null); }}
          placeholder={t("search.replaceAfter")}
          value={replacementText}
        />
        <label className="setting-row replace-regex-row">
          <input
            checked={replaceIsRegex}
            onChange={(e) => setReplaceIsRegex(e.target.checked)}
            type="checkbox"
          />
          <span>{t("search.regex")}</span>
        </label>
        <div className="replace-actions">
          {activeFilePath ? (
            <button
              className="replace-btn"
              disabled={isReplacing || replaceQuery.trim() === ""}
              onClick={handleReplaceInFile}
              title={t("search.replaceCurrentFile")}
              type="button"
            >
              {t("search.replaceCurrentFile")}
            </button>
          ) : null}
          <button
            className="replace-btn"
            disabled={isReplacing || replaceQuery.trim() === ""}
            onClick={handlePreviewBulkReplace}
            type="button"
          >
            {t("search.bulkPreview")}
          </button>
        </div>
        {replaceError ? <div className="error-note">{replaceError}</div> : null}
        {replaceStatus ? <div className="replace-status">{replaceStatus}</div> : null}
        {replacePreview !== null ? (
          <div className="replace-preview">
            <div className="replace-preview-header">
              {t("search.replaceMatchCount", { count: replacePreview.length })}
            </div>
            {replacePreview.length > 0 ? (
              <ul className="search-results replace-preview-list">
                {replacePreview.slice(0, 50).map((m, i) => (
                  <li className="search-result-item" key={`${m.path}-${m.lineNumber}-${i}`}>
                    <span className="search-result-title" title={m.path}>{m.path.split("/").pop()?.replace(/\.md$/, "")}</span>
                    <span className="search-result-line replace-preview-before">{m.lineNumber}: {m.lineText}</span>
                    <span className="search-result-line replace-preview-after">→ {m.newLineText}</span>
                  </li>
                ))}
                {replacePreview.length > 50 ? (
                  <li className="search-result-item">
                    <span className="search-result-line">{t("search.replaceMoreItems", { count: replacePreview.length - 50 })}</span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className="empty-note">{t("search.noMatches")}</div>
            )}
            {replacePreview.length > 0 ? (
              <button
                className="replace-btn replace-btn--confirm"
                disabled={isReplacing}
                onClick={handleApplyBulkReplace}
                type="button"
              >
                {t("search.replace")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">{t("search.tags")}</div>
        {tags.length > 0 ? (
          <ul className="tag-list">
            {tags.map((tag) => (
              <li className="tag-list-item" key={tag.tag}>
                <button className="tag-pill" onClick={() => onTagSelect(tag.tag)} type="button">
                  #{tag.tag}
                </button>
                <span className="tag-count">{tag.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-note">{t("search.tagsEmpty")}</div>
        )}
      </div>
    </div>
  );
}
