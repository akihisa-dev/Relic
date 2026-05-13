import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { SearchMode, WorkspaceSearchResult, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { useT, type Translator } from "../i18n";
import type { FileTreeExpansionRequest } from "./FileTree";
import { FileTree, FileTreeItem, findNodeByPath } from "./FileTree";

export interface FilesSidebarProps {
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isSearching: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFileInFolder?: (folderPath: string) => void;
  onCreateFolder: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onCreateWorkspace: () => void;
  onDeleteItem: (path: string, type: WorkspaceTreeNode["type"]) => void;
  onDeleteItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>) => void;
  onDuplicateFile: (path: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onMoveItems: (items: Array<{ path: string; type: WorkspaceTreeNode["type"] }>, destFolder: string) => void;
  onOpenFile: (path: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenInOtherPane?: (path: string) => void;
  onOpenWorkspace: () => void;
  onRevealItem?: (path: string) => void;
  onRenameItem: (path: string, type: WorkspaceTreeNode["type"], newName: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSelectedCountChange?: (count: number) => void;
  onSearchFrontmatterFieldChange: (field: string) => void;
  onSearchModeChange: (mode: SearchMode) => void;
  onSearchQueryChange: (query: string) => void;
  onTogglePin: (path: string) => void;
  openFilePaths?: Set<string>;
  searchError: string | null;
  searchFocusRequest: number;
  searchFrontmatterCandidates: Record<string, string[]>;
  searchFrontmatterField: string;
  searchMode: SearchMode;
  searchQuery: string;
  searchResults: WorkspaceSearchResult[];
  workspaceState: WorkspaceState | null;
}

export function FilesSidebar({
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isSearching,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFileInFolder,
  onCreateFolder,
  onCreateFolderInFolder,
  onCreateWorkspace,
  onDeleteItem,
  onDeleteItems,
  onDuplicateFile,
  onMoveFile,
  onMoveFolder,
  onMoveItems,
  onOpenFile,
  onOpenInOtherPane,
  onOpenWorkspace,
  onRevealItem,
  onRenameItem,
  onSelectFolder,
  onSelectedCountChange,
  onSearchFrontmatterFieldChange,
  onSearchModeChange,
  onSearchQueryChange,
  onTogglePin,
  openFilePaths,
  searchError,
  searchFocusRequest,
  searchFrontmatterCandidates,
  searchFrontmatterField,
  searchMode,
  searchQuery,
  searchResults,
  workspaceState
}: FilesSidebarProps): ReactElement {
  const [expansionRequest, setExpansionRequest] = useState<FileTreeExpansionRequest | undefined>(undefined);
  const [isSearchMethodMenuOpen, setIsSearchMethodMenuOpen] = useState(false);
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchShellRef = useRef<HTMLDivElement | null>(null);
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const pinnedPaths = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const userNodes = useMemo(() => workspaceState?.fileTree ?? [], [workspaceState?.fileTree]);
  const selectableItems = useMemo(() => {
    const items: Array<{ path: string; type: WorkspaceTreeNode["type"] }> = [];
    const walk = (node: WorkspaceTreeNode): void => {
      items.push({ path: node.path, type: node.type });
      if (node.type === "folder") node.children.forEach(walk);
    };

    userNodes.forEach(walk);
    return items;
  }, [userNodes]);
  const selectablePathSet = useMemo(
    () => new Set(selectableItems.map((item) => item.path)),
    [selectableItems]
  );
  const selectedItems = useMemo(
    () => selectableItems.filter((item) => selectedPaths.has(item.path)),
    [selectableItems, selectedPaths]
  );
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
          ...Object.keys(searchFrontmatterCandidates)
        ])
      ).sort((a, b) => a.localeCompare(b, "ja")),
    [searchFrontmatterCandidates]
  );
  const frontmatterValueCandidates = searchFrontmatterField ? (searchFrontmatterCandidates[searchFrontmatterField] ?? []) : [];
  const isFilteringFiles = searchQuery.trim() !== "" || isSearching || searchError !== null;
  const t = useT();

  useEffect(() => {
    setSelectedPaths((current) => {
      const next = new Set([...current].filter((path) => selectablePathSet.has(path)));
      return next.size === current.size ? current : next;
    });
    if (selectionAnchorPath && !selectablePathSet.has(selectionAnchorPath)) {
      setSelectionAnchorPath(null);
    }
  }, [selectablePathSet, selectionAnchorPath]);

  useEffect(() => {
    onSelectedCountChange?.(selectedItems.length);
  }, [onSelectedCountChange, selectedItems.length]);

  useEffect(() => {
    if (searchFocusRequest <= 0) return;
    searchInputRef.current?.focus();
    setIsSearchMethodMenuOpen(true);
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

  const handleSelectItem = (
    node: WorkspaceTreeNode,
    e: React.MouseEvent<HTMLButtonElement>
  ): boolean => {
    if (!selectablePathSet.has(node.path)) return true;

    const isRangeSelect = e.shiftKey && selectionAnchorPath && selectablePathSet.has(selectionAnchorPath);
    const isToggleSelect = e.metaKey || e.ctrlKey;
    const isMultiSelectionMode = selectedPaths.size > 1;

    if (isRangeSelect) {
      const fromIndex = selectableItems.findIndex((item) => item.path === selectionAnchorPath);
      const toIndex = selectableItems.findIndex((item) => item.path === node.path);
      if (fromIndex >= 0 && toIndex >= 0) {
        const [start, end] = fromIndex < toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
        setSelectedPaths(new Set(selectableItems.slice(start, end + 1).map((item) => item.path)));
      }
      return false;
    }

    if (isToggleSelect) {
      setSelectedPaths((current) => {
        const next = new Set(current);
        if (next.has(node.path)) next.delete(node.path);
        else next.add(node.path);
        return next;
      });
      setSelectionAnchorPath(node.path);
      return false;
    }

    setSelectedPaths(new Set([node.path]));
    setSelectionAnchorPath(node.path);
    return !isMultiSelectionMode;
  };

  const requestExpansion = (action: FileTreeExpansionRequest["action"], scopePath?: string): void => {
    setExpansionRequest((current) => ({ action, id: (current?.id ?? 0) + 1, scopePath }));
  };

  const searchModeOptions: Array<{ label: string; mode: SearchMode }> = [
    { label: t("files.searchModeFullText"), mode: "fullText" },
    { label: t("files.searchModeFileName"), mode: "fileName" },
    { label: t("files.searchModeTag"), mode: "tag" },
    { label: t("files.searchModeFrontmatter"), mode: "frontmatter" },
    { label: t("files.searchModeRegex"), mode: "regex" }
  ];
  const activeSearchModeLabel = searchModeOptions.find((option) => option.mode === searchMode)?.label ?? t("files.searchModeFullText");
  const searchPlaceholder = t("files.searchPlaceholder", { mode: activeSearchModeLabel });

  return (
    <div className="sidebar-section">
      {activeWorkspace ? (
        <>
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
                onFocus={() => setIsSearchMethodMenuOpen(true)}
                placeholder={searchPlaceholder}
                ref={searchInputRef}
                type="search"
                value={searchQuery}
              />
            </label>
            {isSearchMethodMenuOpen ? (
              <div className="files-search-method-menu" role="listbox" aria-label={t("files.searchMethod")}>
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
                <input
                  aria-label={t("files.searchFrontmatterField")}
                  className="search-input"
                  list="files-search-frontmatter-fields"
                  onChange={(event) => onSearchFrontmatterFieldChange(event.target.value)}
                  placeholder={t("files.searchFrontmatterField")}
                  value={searchFrontmatterField}
                />
                <datalist id="files-search-frontmatter-fields">
                  {knownFrontmatterFields.map((field) => (
                    <option key={field} value={field} />
                  ))}
                </datalist>
                {frontmatterValueCandidates.length > 0 ? (
                  <datalist id="files-search-frontmatter-values">
                    {frontmatterValueCandidates.map((candidate) => (
                      <option key={candidate} value={candidate} />
                    ))}
                  </datalist>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            className="primary-button"
            disabled={isCreatingFile}
            onClick={onCreateFile}
            type="button"
          >
            {isCreatingFile ? t("common.running") : t("files.createNote")}
          </button>
          <button
            className="secondary-button"
            disabled={isCreatingFolder}
            onClick={onCreateFolder}
            type="button"
          >
            {isCreatingFolder ? t("common.running") : t("files.createFolder")}
          </button>
          {isFilteringFiles ? (
            <FileSearchResults
              error={searchError}
              frontmatterField={searchFrontmatterField}
              isSearching={isSearching}
              mode={searchMode}
              onOpenFile={onOpenFile}
              query={searchQuery}
              results={searchResults}
              t={t}
            />
          ) : pinnedPaths.size > 0 ? (
            <div className="pinned-section">
              <div className="pinned-section-heading">{t("files.pinned")}</div>
              <ul className="file-tree">
                {(workspaceState?.pinnedPaths ?? []).map((p) => {
                  const node = findNodeByPath(workspaceState?.fileTree ?? [], p);

                  if (!node) return null;

                  return (
                    <FileTreeItem
                      expansionRequest={expansionRequest}
                      isPinned
                      key={p}
                      node={node}
                      onDeleteItem={onDeleteItem}
                      onDeleteSelectedItems={() => onDeleteItems(selectedItems)}
                      onCreateFileInFolder={onCreateFileInFolder}
                      onCreateFolderInFolder={onCreateFolderInFolder}
                      onDuplicateFile={onDuplicateFile}
                      onMoveFile={onMoveFile}
                      onMoveFolder={onMoveFolder}
                      onMoveItems={onMoveItems}
                      onOpenFile={onOpenFile}
                      onOpenInOtherPane={onOpenInOtherPane}
                      onRequestExpansion={requestExpansion}
                      onRevealItem={onRevealItem}
                      onRenameItem={onRenameItem}
                      onSelectFolder={onSelectFolder}
                      onSelectItem={handleSelectItem}
                      onTogglePin={onTogglePin}
                      openFilePaths={openFilePaths}
                      pinnedPaths={pinnedPaths}
                      selectedItems={selectedItems}
                      selectedPaths={selectedPaths}
                    />
                  );
                })}
              </ul>
            </div>
          ) : null}
          {isFilteringFiles ? null : (
            <FileTree
              expansionRequest={expansionRequest}
              isRoot
              nodes={userNodes}
              onDeleteItem={onDeleteItem}
              onDeleteSelectedItems={() => onDeleteItems(selectedItems)}
              onCreateFileInFolder={onCreateFileInFolder}
              onCreateFolderInFolder={onCreateFolderInFolder}
              onDuplicateFile={onDuplicateFile}
              onMoveFile={onMoveFile}
              onMoveFolder={onMoveFolder}
              onMoveItems={onMoveItems}
              onOpenFile={onOpenFile}
              onOpenInOtherPane={onOpenInOtherPane}
              onRequestExpansion={requestExpansion}
              onRevealItem={onRevealItem}
              onRenameItem={onRenameItem}
              onSelectFolder={onSelectFolder}
              onSelectItem={handleSelectItem}
              onTogglePin={onTogglePin}
              openFilePaths={openFilePaths}
              pinnedPaths={pinnedPaths}
              selectedItems={selectedItems}
              selectedPaths={selectedPaths}
            />
          )}
          <div className="workspace-actions">
            <button
              className="secondary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onOpenWorkspace}
              type="button"
            >
              {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
            </button>
            <button
              className="secondary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onCreateWorkspace}
              type="button"
            >
              {isCreatingWorkspace ? t("files.creatingWorkspace") : t("files.createNewWorkspace")}
            </button>
          </div>
        </>
      ) : (
        <div className="workspace-empty">
          <div>
            <p className="workspace-empty-title">{t("files.workspaceEmptyTitle")}</p>
            <p className="workspace-empty-copy">{t("files.workspaceHint")}</p>
          </div>
          <div className="workspace-empty-actions">
            <button
              className="primary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onOpenWorkspace}
              type="button"
            >
              {isOpeningWorkspace ? t("files.opening") : t("files.openFolder")}
            </button>
            <button
              className="secondary-button"
              disabled={isOpeningWorkspace || isCreatingWorkspace}
              onClick={onCreateWorkspace}
              type="button"
            >
              {isCreatingWorkspace ? t("files.creatingWorkspace") : t("files.createNewWorkspace")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FileSearchResults({
  error,
  frontmatterField,
  isSearching,
  mode,
  onOpenFile,
  query,
  results,
  t
}: {
  error: string | null;
  frontmatterField: string;
  isSearching: boolean;
  mode: SearchMode;
  onOpenFile: (path: string, event?: React.MouseEvent<HTMLButtonElement>) => void;
  query: string;
  results: WorkspaceSearchResult[];
  t: Translator;
}): ReactElement {
  if (error) return <div className="error-note">{error}</div>;
  if (isSearching) return <div className="list-loading-note">{t("common.loading")}</div>;
  if (mode === "frontmatter" && query.trim() !== "" && !frontmatterField.trim()) return <div className="empty-note">{t("search.noField")}</div>;

  return (
    <div className="files-search-results">
      <div className="links-panel-subheading">
        {t("files.searchResults", { count: results.length })}
      </div>
      {results.length > 0 ? (
        <ul className="search-results">
          {results.map((result, index) => (
            <li className="search-result-item" key={`${result.path}-${result.lineNumber}-${index}`}>
              <button
                className="search-result-button"
                onClick={(event) => onOpenFile(result.path, event)}
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
