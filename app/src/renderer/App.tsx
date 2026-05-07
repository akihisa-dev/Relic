import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  AppInfo,
  AutoSyncSettings,
  Backlink,
  GitCommitDiff,
  GitBranchSummary,
  GitConflict,
  AppTheme,
  EditorSettings,
  GitCommitSummary,
  GitHubAuthStatus,
  GitRemoteSummary,
  GitStatus,
  GitSyncPreview,
  GitTagSummary,
  GitWorkingChange,
  MarkdownFileContent,
  SearchAndReplaceMatch,
  SearchMode,
  WorkspaceState,
  WorkspaceSearchResult,
  WorkspaceTagSummary,
  WorkspaceTreeNode
} from "../shared/ipc";
import { defaultAutoSyncSettings, defaultFeatureToggles, type FeatureToggles, type MergeFilterType, type MergeSortBy, type SplitHeadingLevel } from "../shared/ipc";
import { resolveWikiLinkPath, resolveWikiLinks } from "../shared/links";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { Editor } from "./components/Editor";
import { FrontmatterForm } from "./components/FrontmatterForm";
import { Preview } from "./components/Preview";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { Toolbar } from "./components/Toolbar";
import { useAutoSave } from "./hooks/useAutoSave";
import { createTranslator, I18nProvider, useT, type TranslationKey } from "./i18n";
import { useEditorStore, type PaneId } from "./store/editorStore";
import { useUiStore, type SidebarView } from "./store/uiStore";
import "./styles.css";

// ────────────────────────────────────────────────
// FileTree
// ────────────────────────────────────────────────

function findNodeByPath(nodes: WorkspaceTreeNode[], targetPath: string): WorkspaceTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.type === "folder") {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }

  return null;
}

interface FileTreeProps {
  activePaths: Set<string>;
  isRoot?: boolean;
  nodes: WorkspaceTreeNode[];
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
}

function FileTreeItem({
  activePaths,
  isPinned,
  node,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onSelectFolder,
  onTogglePin,
  pinnedPaths
}: {
  activePaths: Set<string>;
  isPinned?: boolean;
  node: WorkspaceTreeNode;
  onMoveFile?: (path: string, destFolder: string) => void;
  onMoveFolder?: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onTogglePin?: (path: string) => void;
  pinnedPaths?: Set<string>;
}): ReactElement {
  const t = useT();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const isFolder = node.type === "folder";

  const handleDrop = (e: React.DragEvent, destFolder: string): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const raw = e.dataTransfer.getData("application/relic-item");
    if (!raw) return;

    const { path: srcPath, type } = JSON.parse(raw) as { path: string; type: string };
    if (srcPath === destFolder) return;
    if (type === "folder" && (destFolder === srcPath || destFolder.startsWith(srcPath + "/"))) return;

    if (type === "file") onMoveFile?.(srcPath, destFolder);
    else onMoveFolder?.(srcPath, destFolder);
  };

  return (
    <li className="file-tree-item">
      <div className="file-tree-row-wrap">
        <button
          className={`file-tree-row ${node.type}${activePaths.has(node.path) ? " active" : ""}${isDragOver ? " drag-over" : ""}`}
          draggable
          onDragEnd={() => setIsDragOver(false)}
          onDragLeave={isFolder ? (e) => { e.stopPropagation(); setIsDragOver(false); } : undefined}
          onDragOver={isFolder ? (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); } : undefined}
          onDragStart={(e) => {
            e.dataTransfer.setData("application/relic-item", JSON.stringify({ path: node.path, type: node.type }));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDrop={isFolder ? (e) => handleDrop(e, node.path) : undefined}
          onClick={() => {
            if (node.type === "file") {
              onOpenFile(node.path);
            } else {
              setIsExpanded((v) => !v);
              onSelectFolder(node);
            }
          }}
          type="button"
        >
          <span className="file-tree-icon">{node.type === "folder" ? (isExpanded ? "▼" : "▶") : "·"}</span>
          <span className="file-tree-name">{node.name}</span>
        </button>
        {onTogglePin ? (
          <button
            className={`file-tree-pin-btn${isPinned ? " pinned" : ""}`}
            onClick={(e) => { e.stopPropagation(); onTogglePin(node.path); }}
            title={isPinned ? t("files.unpin") : t("files.pin")}
            type="button"
          >
            📌
          </button>
        ) : null}
      </div>
      {node.type === "folder" && isExpanded && node.children.length > 0 ? (
        <FileTree
          activePaths={activePaths}
          nodes={node.children}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onOpenFile={onOpenFile}
          onSelectFolder={onSelectFolder}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
        />
      ) : null}
    </li>
  );
}

function FileTree({
  activePaths,
  isRoot = false,
  nodes,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onSelectFolder,
  onTogglePin,
  pinnedPaths
}: FileTreeProps): ReactElement {
  const t = useT();
  const [isRootDragOver, setIsRootDragOver] = useState(false);

  if (nodes.length === 0 && !isRoot) {
    return <div className="empty-note">{t("files.noMarkdownFiles")}</div>;
  }

  const handleRootDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setIsRootDragOver(false);

    const raw = e.dataTransfer.getData("application/relic-item");
    if (!raw) return;

    const { path: srcPath, type } = JSON.parse(raw) as { path: string; type: string };
    if (!srcPath.includes("/")) return;

    if (type === "file") onMoveFile?.(srcPath, "");
    else onMoveFolder?.(srcPath, "");
  };

  return (
    <ul
      className={`file-tree${isRoot && isRootDragOver ? " file-tree--drag-over" : ""}`}
      onDragLeave={isRoot ? (e) => { if (e.currentTarget === e.target) setIsRootDragOver(false); } : undefined}
      onDragOver={isRoot ? (e) => { e.preventDefault(); setIsRootDragOver(true); } : undefined}
      onDrop={isRoot ? handleRootDrop : undefined}
    >
      {nodes.length === 0 ? (
        <li><div className="empty-note">{t("files.noMarkdownFiles")}</div></li>
      ) : null}
      {nodes.map((node) => (
        <FileTreeItem
          activePaths={activePaths}
          isPinned={pinnedPaths?.has(node.path)}
          key={node.path}
          node={node}
          onMoveFile={onMoveFile}
          onMoveFolder={onMoveFolder}
          onOpenFile={onOpenFile}
          onSelectFolder={onSelectFolder}
          onTogglePin={onTogglePin}
          pinnedPaths={pinnedPaths}
        />
      ))}
    </ul>
  );
}

// ────────────────────────────────────────────────
// SidebarContent
// ────────────────────────────────────────────────

interface FilesSidebarProps {
  activePaths: Set<string>;
  fileNameDraft: string;
  folderNameDraft: string;
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  isCreatingWorkspace: boolean;
  isOpeningWorkspace: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onCreateWorkspace: () => void;
  onFileNameDraftChange: (v: string) => void;
  onFolderNameDraftChange: (v: string) => void;
  onMoveFile: (path: string, destFolder: string) => void;
  onMoveFolder: (path: string, destFolder: string) => void;
  onOpenFile: (path: string) => void;
  onOpenWorkspace: () => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSwitchWorkspace: (id: string) => void;
  onTogglePin: (path: string) => void;
  workspaceState: WorkspaceState | null;
}

function SearchSidebar({
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

function FilesSidebar({
  activePaths,
  fileNameDraft,
  folderNameDraft,
  isCreatingFile,
  isCreatingFolder,
  isCreatingWorkspace,
  isOpeningWorkspace,
  onCreateFile,
  onCreateFolder,
  onCreateWorkspace,
  onFileNameDraftChange,
  onFolderNameDraftChange,
  onMoveFile,
  onMoveFolder,
  onOpenFile,
  onOpenWorkspace,
  onSelectFolder,
  onSwitchWorkspace,
  onTogglePin,
  workspaceState
}: FilesSidebarProps): ReactElement {
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;
  const pinnedPaths = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const t = useT();

  return (
    <div className="sidebar-section">
      <div className="workspace-card">
        <div className="workspace-name" title={activeWorkspace?.path}>
          {activeWorkspace ? activeWorkspace.name : t("files.noWorkspace")}
        </div>
      </div>
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
      {workspaceState && workspaceState.workspaces.length > 1 ? (
        <div className="workspace-list" aria-label="Registered workspaces">
          {workspaceState.workspaces.map((ws) => (
            <button
              className={`workspace-list-item${ws.id === activeWorkspace?.id ? " active" : ""}`}
              key={ws.id}
              onClick={() => onSwitchWorkspace(ws.id)}
              title={ws.path}
              type="button"
            >
              {ws.name}
            </button>
          ))}
        </div>
      ) : null}
      {activeWorkspace ? (
        <>
          <form
            className="new-file-form"
            onSubmit={(e) => {
              e.preventDefault();
              onCreateFile();
            }}
          >
            <input
              aria-label={t("files.newNoteName")}
              className="text-input"
              onChange={(e) => onFileNameDraftChange(e.target.value)}
              placeholder={t("files.newNoteName")}
              value={fileNameDraft}
            />
            <button disabled={isCreatingFile} type="submit">
              {t("common.create")}
            </button>
          </form>
          <form
            className="new-file-form"
            onSubmit={(e) => {
              e.preventDefault();
              onCreateFolder();
            }}
          >
            <input
              aria-label={t("files.newFolderName")}
              className="text-input"
              onChange={(e) => onFolderNameDraftChange(e.target.value)}
              placeholder={t("files.newFolderName")}
              value={folderNameDraft}
            />
            <button disabled={isCreatingFolder} type="submit">
              {t("files.createFolder")}
            </button>
          </form>
          {pinnedPaths.size > 0 ? (
            <div className="pinned-section">
              <div className="pinned-section-heading">{t("files.pinned")}</div>
              <ul className="file-tree">
                {(workspaceState?.pinnedPaths ?? []).map((p) => {
                  const node = findNodeByPath(workspaceState?.fileTree ?? [], p);

                  if (!node) return null;

                  return (
                    <FileTreeItem
                      activePaths={activePaths}
                      isPinned
                      key={p}
                      node={node}
                      onMoveFile={onMoveFile}
                      onMoveFolder={onMoveFolder}
                      onOpenFile={onOpenFile}
                      onSelectFolder={onSelectFolder}
                      onTogglePin={onTogglePin}
                      pinnedPaths={pinnedPaths}
                    />
                  );
                })}
              </ul>
            </div>
          ) : null}
          <FileTree
            activePaths={activePaths}
            isRoot
            nodes={workspaceState?.fileTree ?? []}
            onMoveFile={onMoveFile}
            onMoveFolder={onMoveFolder}
            onOpenFile={onOpenFile}
            onSelectFolder={onSelectFolder}
            onTogglePin={onTogglePin}
            pinnedPaths={pinnedPaths}
          />
        </>
      ) : (
        <div className="empty-note">{t("files.workspaceHint")}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// ToolsSidebar
// ────────────────────────────────────────────────

function ToolsSidebar({ workspacePath }: { workspacePath: string | null }): ReactElement {
  const t = useT();
  const [titleListFolder, setTitleListFolder] = useState("");
  const [titleListOutputFolder, setTitleListOutputFolder] = useState("");
  const [titleListOutputName, setTitleListOutputName] = useState("Title List");
  const [titleListSort, setTitleListSort] = useState<"name" | "mtime">("name");
  const [titleListStatus, setTitleListStatus] = useState<string | null>(null);

  const [tocFolder, setTocFolder] = useState("");
  const [tocOutputFolder, setTocOutputFolder] = useState("");
  const [tocOutputName, setTocOutputName] = useState("Table of Contents");
  const [tocSubfolders, setTocSubfolders] = useState(true);
  const [tocStatus, setTocStatus] = useState<string | null>(null);

  const [mergeFilterType, setMergeFilterType] = useState<MergeFilterType>("all");
  const [mergeFilterValue, setMergeFilterValue] = useState("");
  const [mergeSortBy, setMergeSortBy] = useState<MergeSortBy>("name");
  const [mergeInsertHeading, setMergeInsertHeading] = useState(true);
  const [mergeOutputFolder, setMergeOutputFolder] = useState("");
  const [mergeOutputName, setMergeOutputName] = useState("Merged Result");
  const [mergeStatus, setMergeStatus] = useState<string | null>(null);

  const [splitSource, setSplitSource] = useState("");
  const [splitLevel, setSplitLevel] = useState<SplitHeadingLevel>(2);
  const [splitOutputFolder, setSplitOutputFolder] = useState("");
  const [splitStatus, setSplitStatus] = useState<string | null>(null);

  const handleGenerateTitleList = async () => {
    if (!workspacePath) return;
    setTitleListStatus(t("common.running"));
    const result = await window.relic!.generateTitleList({
      filterFolder: titleListFolder || undefined,
      outputFolder: titleListOutputFolder || ".",
      outputName: titleListOutputName || t("tools.titleListDefaultName"),
      sortBy: titleListSort
    });
    setTitleListStatus(result.ok ? `Done: ${result.value}` : `Error: ${result.error.message}`);
  };

  const handleGenerateToc = async () => {
    if (!workspacePath) return;
    setTocStatus(t("common.running"));
    const result = await window.relic!.generateTableOfContents({
      includeSubfolders: tocSubfolders,
      outputFolder: tocOutputFolder || ".",
      outputName: tocOutputName || t("tools.tocDefaultName"),
      targetFolder: tocFolder || "."
    });
    setTocStatus(result.ok ? `Done: ${result.value}` : `Error: ${result.error.message}`);
  };

  const handleMergeFiles = async () => {
    if (!workspacePath) return;
    setMergeStatus(t("tools.processing"));
    const result = await window.relic!.mergeFiles({
      filterType: mergeFilterType,
      filterValue: mergeFilterValue,
      insertFilenameHeading: mergeInsertHeading,
      outputFolder: mergeOutputFolder || ".",
      outputName: mergeOutputName || t("tools.mergeDefaultName"),
      sortBy: mergeSortBy
    });
    setMergeStatus(result.ok ? `Done: ${result.value}` : `Error: ${result.error.message}`);
  };

  const handleSplitFile = async () => {
    if (!workspacePath || !splitSource) return;
    setSplitStatus(t("tools.processing"));
    const result = await window.relic!.splitFileByHeading({
      headingLevel: splitLevel,
      outputFolder: splitOutputFolder || ".",
      sourcePath: splitSource
    });
    setSplitStatus(
      result.ok
        ? `Done: ${result.value.length} file(s) created`
        : `Error: ${result.error.message}`
    );
  };

  return (
    <div className="sidebar-section">
      <div className="pane-heading">{t("tools.tools")}</div>
      {!workspacePath ? (
        <div className="empty-note">{t("tools.workspaceRequired")}</div>
      ) : (
        <>
          <div className="links-panel-subheading">{t("tools.titleList")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.filterFolder")}</span>
              <input
                onChange={(e) => setTitleListFolder(e.target.value)}
                placeholder={t("tools.placeholderAll")}
                type="text"
                value={titleListFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.sort")}</span>
              <select
                onChange={(e) => setTitleListSort(e.target.value as "name" | "mtime")}
                value={titleListSort}
              >
                <option value="name">{t("tools.sortName")}</option>
                <option value="mtime">{t("tools.sortMtime")}</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setTitleListOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={titleListOutputFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.fileName")}</span>
              <input
                onChange={(e) => setTitleListOutputName(e.target.value)}
                type="text"
                value={titleListOutputName}
              />
            </label>
            <button className="primary-button" onClick={handleGenerateTitleList} type="button">
              {t("common.create")}
            </button>
            {titleListStatus && <div className={`tool-status${titleListStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{titleListStatus}</div>}
          </div>

          <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.tableOfContents")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.filterFolder")}</span>
              <input
                onChange={(e) => setTocFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={tocFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.includeSubfolders")}</span>
              <input
                checked={tocSubfolders}
                onChange={(e) => setTocSubfolders(e.target.checked)}
                type="checkbox"
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setTocOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={tocOutputFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.fileName")}</span>
              <input
                onChange={(e) => setTocOutputName(e.target.value)}
                type="text"
                value={tocOutputName}
              />
            </label>
            <button className="primary-button" onClick={handleGenerateToc} type="button">
              {t("common.create")}
            </button>
            {tocStatus && <div className={`tool-status${tocStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{tocStatus}</div>}
          </div>

          <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.merge")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.filter")}</span>
              <select
                onChange={(e) => setMergeFilterType(e.target.value as MergeFilterType)}
                value={mergeFilterType}
              >
                <option value="all">{t("tools.filterAll")}</option>
                <option value="folder">{t("tools.filterFolder")}</option>
                <option value="tag">{t("tools.filterTag")}</option>
              </select>
            </label>
            {mergeFilterType !== "all" && (
              <label className="setting-row">
                <span>{mergeFilterType === "folder" ? t("tools.folderName") : t("tools.tagName")}</span>
                <input
                  onChange={(e) => setMergeFilterValue(e.target.value)}
                  placeholder={mergeFilterType === "folder" ? t("tools.placeholderFolderExample") : t("tools.placeholderTagExample")}
                  type="text"
                  value={mergeFilterValue}
                />
              </label>
            )}
            <label className="setting-row">
              <span>{t("tools.sort")}</span>
              <select
                onChange={(e) => setMergeSortBy(e.target.value as MergeSortBy)}
                value={mergeSortBy}
              >
                <option value="name">{t("tools.sortName")}</option>
                <option value="mtime">{t("tools.sortMtime")}</option>
                <option value="ctime">{t("tools.sortCtime")}</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t("tools.fileNameHeading")}</span>
              <input
                checked={mergeInsertHeading}
                onChange={(e) => setMergeInsertHeading(e.target.checked)}
                type="checkbox"
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setMergeOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={mergeOutputFolder}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.fileName")}</span>
              <input
                onChange={(e) => setMergeOutputName(e.target.value)}
                type="text"
                value={mergeOutputName}
              />
            </label>
            <button className="primary-button" onClick={handleMergeFiles} type="button">
              {t("tools.merge")}
            </button>
            {mergeStatus && <div className={`tool-status${mergeStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{mergeStatus}</div>}
          </div>

          <div className="links-panel-subheading" style={{ marginTop: "1.5rem" }}>{t("tools.splitByHeading")}</div>
          <div className="search-block">
            <label className="setting-row">
              <span>{t("tools.sourceFile")}</span>
              <input
                onChange={(e) => setSplitSource(e.target.value)}
                placeholder={t("tools.placeholderSourceExample")}
                type="text"
                value={splitSource}
              />
            </label>
            <label className="setting-row">
              <span>{t("tools.headingLevel")}</span>
              <select
                onChange={(e) => setSplitLevel(Number(e.target.value) as SplitHeadingLevel)}
                value={splitLevel}
              >
                <option value={1}>H1 (#)</option>
                <option value={2}>H2 (##)</option>
                <option value={3}>H3 (###)</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t("tools.outputFolder")}</span>
              <input
                onChange={(e) => setSplitOutputFolder(e.target.value)}
                placeholder={t("tools.placeholderRoot")}
                type="text"
                value={splitOutputFolder}
              />
            </label>
            <button className="primary-button" onClick={handleSplitFile} type="button">
              {t("tools.splitByHeading")}
            </button>
            {splitStatus && <div className={`tool-status${splitStatus.startsWith("Error") ? " tool-status--error" : " tool-status--success"}`}>{splitStatus}</div>}
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// SettingsSidebar
// ────────────────────────────────────────────────

function SettingsSidebar({
  appInfo,
  settings,
  autoSyncSettings,
  featureToggles,
  onCreateFrontmatterTemplate,
  onSave,
  onAutoSyncSave,
  onFeatureTogglesSave
}: {
  appInfo: AppInfo | null;
  settings: EditorSettings;
  autoSyncSettings: AutoSyncSettings;
  featureToggles: FeatureToggles;
  onCreateFrontmatterTemplate: () => void;
  onSave: (s: EditorSettings) => void;
  onAutoSyncSave: (s: AutoSyncSettings) => void;
  onFeatureTogglesSave: (t: FeatureToggles) => void;
}): ReactElement {
  const [draft, setDraft] = useState<EditorSettings>(settings);
  const [autoSyncDraft, setAutoSyncDraft] = useState<AutoSyncSettings>(autoSyncSettings);
  const [togglesDraft, setTogglesDraft] = useState<FeatureToggles>(featureToggles);
  const t = useT();

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setAutoSyncDraft(autoSyncSettings);
  }, [autoSyncSettings]);

  useEffect(() => {
    setTogglesDraft(featureToggles);
  }, [featureToggles]);

  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSave(next);
  };

  const updateAutoSync = <K extends keyof AutoSyncSettings>(key: K, value: AutoSyncSettings[K]): void => {
    const next = { ...autoSyncDraft, [key]: value };
    setAutoSyncDraft(next);
    onAutoSyncSave(next);
  };

  return (
    <div className="sidebar-section settings-section">
      <label className="setting-row">
        <span>{t("settings.font")}</span>
        <select
          aria-label={t("settings.font")}
          onChange={(e) => update("font", e.target.value as EditorSettings["font"])}
          value={draft.font}
        >
          <option value="system">{t("settings.fontSystem")}</option>
          <option value="mincho">{t("settings.fontMincho")}</option>
          <option value="mono">Menlo</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{t("settings.fontSize")}</span>
        <input
          max={32}
          min={10}
          onChange={(e) => update("fontSize", Number(e.target.value))}
          type="number"
          value={draft.fontSize}
        />
      </label>
      <label className="setting-row">
        <span>{t("settings.lineHeight")}</span>
        <input
          max={3}
          min={1}
          onChange={(e) => update("lineHeight", Number(e.target.value))}
          step={0.1}
          type="number"
          value={draft.lineHeight}
        />
      </label>
      <label className="setting-row">
        <span>{t("settings.maxWidth")}</span>
        <select
          aria-label={t("settings.maxWidth")}
          onChange={(e) => update("maxWidth", e.target.value as EditorSettings["maxWidth"])}
          value={draft.maxWidth}
        >
          <option value="550px">{t("settings.maxWidthNarrow")}</option>
          <option value="660px">{t("settings.maxWidthStandard")}</option>
          <option value="800px">{t("settings.maxWidthWide")}</option>
          <option value="none">{t("settings.maxWidthNone")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{t("settings.language")}</span>
        <select
          aria-label={t("settings.language")}
          onChange={(e) => update("language", e.target.value as EditorSettings["language"])}
          value={draft.language}
        >
          <option value="system">{t("settings.languageSystem")}</option>
          <option value="en">{t("settings.languageEnglish")}</option>
          <option value="ja">{t("settings.languageJapanese")}</option>
        </select>
      </label>
      <label className="setting-row">
        <input
          checked={draft.showLineNumbers}
          onChange={(e) => update("showLineNumbers", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.showLineNumbers")}</span>
      </label>
      <label className="setting-row">
        <input
          checked={draft.spellCheck}
          onChange={(e) => update("spellCheck", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.spellCheck")}</span>
      </label>
      <label className="setting-row">
        <span>{t("settings.theme")}</span>
        <select
          aria-label={t("settings.theme")}
          onChange={(e) => update("theme", e.target.value as EditorSettings["theme"])}
          value={draft.theme}
        >
          <option value="system">{t("settings.themeSystem")}</option>
          <option value="light">{t("settings.light")}</option>
          <option value="dark">{t("settings.dark")}</option>
        </select>
      </label>
      <div className="setting-row setting-row--action">
        <span>{t("settings.frontmatterTemplate")}</span>
        <button className="setting-action-btn" onClick={onCreateFrontmatterTemplate} type="button">
          {t("settings.createFrontmatterTemplate")}
        </button>
      </div>
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.autoSync")}</div>
      <label className="setting-row">
        <input
          checked={autoSyncDraft.autoPull}
          onChange={(e) => updateAutoSync("autoPull", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.autoPull")}</span>
      </label>
      <label className="setting-row">
        <input
          checked={autoSyncDraft.autoPush}
          onChange={(e) => updateAutoSync("autoPush", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.autoPush")}</span>
      </label>
      <label className="setting-row">
        <span>{t("settings.interval")}</span>
        <select
          aria-label={t("settings.interval")}
          disabled={!autoSyncDraft.autoPull && !autoSyncDraft.autoPush}
          onChange={(e) => updateAutoSync("intervalMinutes", Number(e.target.value) as AutoSyncSettings["intervalMinutes"])}
          value={autoSyncDraft.intervalMinutes}
        >
          <option value={5}>5 min</option>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>60 min</option>
        </select>
      </label>
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.featureToggles")}</div>
      {(
        [
          { key: "git", label: t("settings.featureGit") },
          { key: "tools", label: t("settings.featureTools") },
          { key: "frontmatter", label: t("settings.featureFrontmatter") },
          { key: "rightPanel", label: t("settings.featureRightPanel") },
          { key: "focusModes", label: t("settings.featureFocusModes") }
        ] as { key: keyof FeatureToggles; label: string }[]
      ).map(({ key, label }) => (
        <label className="setting-row" key={key}>
          <input
            checked={togglesDraft[key]}
            onChange={(e) => {
              const next = { ...togglesDraft, [key]: e.target.checked };
              setTogglesDraft(next);
              onFeatureTogglesSave(next);
            }}
            type="checkbox"
          />
          <span>{label}</span>
        </label>
      ))}
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.appInfo")}</div>
      <div className="settings-info">
        <div>Relic {appInfo?.version ?? "0.0.0"}</div>
        <div>{appInfo?.platform ?? "darwin"}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────��─────────────
// PaneView — タブバー + エディタ
// ────────────���────────────────────────────���──────

interface PaneViewProps {
  allFilePaths: string[];
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  pane: PaneId;
  scrollTargetHeading?: string;
  showFrontmatter?: boolean;
  typewriterMode: boolean;
  workspacePath?: string | null;
  workspaceTags: string[];
  onCreateNote: (name: string) => void;
  onFocus: () => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onScrollTargetHandled?: () => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
  onTagSearch: (tag: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onOpenInOtherPane: (tabId: string) => void;
  isSplitView: boolean;
}

function PaneView({
  allFilePaths,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  pane,
  scrollTargetHeading,
  showFrontmatter = true,
  typewriterMode,
  workspacePath,
  workspaceTags,
  onCreateNote,
  onFocus,
  onOpenWikiLink,
  onScrollTargetHandled,
  onTabClose,
  onTabSelect,
  onTagSearch,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onOpenInOtherPane,
  isSplitView
}: PaneViewProps): ReactElement {
  const [newNoteName, setNewNoteName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const { leftPane, rightPane, tabs, updateTabContent, setTabViewMode } = useEditorStore();
  const paneState = pane === "left" ? leftPane : rightPane;
  const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  const viewRef = useRef<EditorView | null>(null);
  const t = useT();

  // コンテキストメニューを外部クリックで閉じる
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // 自動保存
  useAutoSave(activeTab?.content ?? "", activeTab?.path ?? null, activeTab !== null);

  // アウトライン見出しジャンプ
  useEffect(() => {
    if (!scrollTargetHeading || !viewRef.current) return;
    const view = viewRef.current;
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (/^#{1,6} /.test(line.text) && line.text.replace(/^#{1,6} /, "") === scrollTargetHeading) {
        view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
        break;
      }
    }
    onScrollTargetHandled?.();
  }, [scrollTargetHeading, onScrollTargetHandled]);

  // 文字数・単語数
  const charCount = activeTab?.content.length ?? 0;
  const wordCount = activeTab
    ? activeTab.content.split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div
      className={`pane${focusedPane === pane ? " pane--focused" : ""}`}
      onClick={onFocus}
    >
      {/* ペインのタブバー */}
      <div className="pane-tab-bar">
        {paneState.tabIds.map((tabId) => {
          const tab = tabs[tabId];

          if (!tab) return null;

          return (
            <div
              className={`pane-tab${paneState.activeTabId === tabId ? " pane-tab--active" : ""}`}
              key={tabId}
              onClick={(e) => {
                e.stopPropagation();
                onTabSelect(tabId);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ tabId, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="pane-tab-name">{tab.name}</span>
              <button
                className="pane-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tabId);
                }}
                title={t("pane.closeTab")}
                type="button"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {contextMenu ? (
        <div
          className="tab-context-menu"
          onClick={(e) => e.stopPropagation()}
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => { onTabClose(contextMenu.tabId); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeTab")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseOtherTabs(contextMenu.tabId); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeOtherTabs")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseTabsToRight(contextMenu.tabId); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeTabsToRight")}
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseAllTabs(); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeAllTabs")}
          </button>
          {isSplitView ? (
            <>
              <div className="tab-context-menu-separator" />
              <button
                className="tab-context-menu-item"
                onClick={() => { onOpenInOtherPane(contextMenu.tabId); setContextMenu(null); }}
                type="button"
              >
                {t("pane.openInOtherPane")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* エディタ本体 or 空状態 */}
      {activeTab ? (
        <div className="editor-surface">
          <div className="editor-mode-bar">
            <Toolbar viewRef={viewRef} />
            <div className="editor-mode-toggle">
              <button
                className={`mode-btn${activeTab.viewMode === "preview" ? " mode-btn--active" : ""}`}
                onClick={() => setTabViewMode(activeTab.id, "preview")}
                type="button"
              >
                Preview
              </button>
              <button
                className={`mode-btn${activeTab.viewMode === "source" ? " mode-btn--active" : ""}`}
                onClick={() => setTabViewMode(activeTab.id, "source")}
                type="button"
              >
                Source
              </button>
            </div>
          </div>
          <div className="editor-body">
            {activeTab.viewMode === "preview" ? (
              <div className="preview-with-fm">
                {showFrontmatter && (
                  <FrontmatterForm
                    candidates={frontmatterCandidates}
                    content={activeTab.content}
                    key={`fm-${activeTab.id}`}
                    onChange={(content) => updateTabContent(activeTab.id, content)}
                    workspaceTags={workspaceTags}
                  />
                )}
                <Preview
                  content={activeTab.content}
                  key={`preview-${activeTab.id}`}
                  onChange={(content) => updateTabContent(activeTab.id, content)}
                  onOpenWikiLink={onOpenWikiLink}
                  onScrollTargetHandled={onScrollTargetHandled}
                  onTagSearch={onTagSearch}
                  scrollTargetHeading={scrollTargetHeading}
                  settings={editorSettings}
                  workspacePath={workspacePath}
                />
              </div>
            ) : (
              <Editor
                allFilePaths={allFilePaths}
                content={activeTab.content}
                key={activeTab.id}
                onChange={(content) => updateTabContent(activeTab.id, content)}
                settings={editorSettings}
                typewriterMode={typewriterMode}
                viewRef={viewRef}
              />
            )}
          </div>
          <div className="pane-status">
            <span>{t("app.wordCount", { chars: charCount, words: wordCount })}</span>
          </div>
        </div>
      ) : (
        <div className="empty-pane">
          <p className="empty-pane-message">{t("pane.noNotes")}</p>
          {workspacePath ? (
            <form
              className="empty-pane-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newNoteName.trim()) {
                  onCreateNote(newNoteName.trim());
                  setNewNoteName("");
                }
              }}
            >
              <input
                aria-label={t("pane.enterNoteName")}
                className="text-input"
                onChange={(e) => setNewNoteName(e.target.value)}
                placeholder={t("pane.enterNoteName")}
                value={newNoteName}
              />
              <button className="primary-button" disabled={!newNoteName.trim()} type="submit">
                {t("pane.createNote")}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────

const IconFiles = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M3 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" />
  </svg>
);

const IconSearch = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="8.5" cy="8.5" r="5" />
    <line x1="13" x2="17" y1="13" y2="17" />
  </svg>
);

const IconGit = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="15" r="2" />
    <circle cx="14" cy="5" r="2" />
    <line x1="6" x2="6" y1="7" y2="13" />
    <path d="M14 7c0 4-8 4-8 8" />
  </svg>
);

const IconTools = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M15 3a3.5 3.5 0 0 0-3.2 4.9L4.1 15.5a1.5 1.5 0 0 0 2.1 2.1l7.6-7.7A3.5 3.5 0 0 0 18.5 6.5L16 9l-2-2 2.5-2.5A3.5 3.5 0 0 0 15 3z" />
  </svg>
);

const IconSettings = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="5" y2="5" />
    <line x1="3" x2="17" y1="10" y2="10" />
    <line x1="3" x2="17" y1="15" y2="15" />
    <circle cx="7" cy="5" fill="currentColor" r="2" stroke="none" />
    <circle cx="13" cy="10" fill="currentColor" r="2" stroke="none" />
    <circle cx="7" cy="15" fill="currentColor" r="2" stroke="none" />
  </svg>
);

const sidebarViewDefs: Array<{ id: SidebarView; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "search", labelKey: "nav.search", icon: <IconSearch /> },
  { id: "git", labelKey: "nav.git", icon: <IconGit /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "error" | "info" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string, type: "error" | "info" = "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);
  const setWorkspaceError = useCallback((msg: string | null) => {
    if (msg) showToast(msg, "error");
  }, [showToast]);
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTagSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fullText");
  const [searchFrontmatterField, setSearchFrontmatterField] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<string | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<string | undefined>(undefined);
  const [frontmatterCandidates, setFrontmatterCandidates] = useState<Record<string, string[]>>({});
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitHubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [gitRemotes, setGitRemotes] = useState<GitRemoteSummary[]>([]);
  const [gitBranches, setGitBranches] = useState<GitBranchSummary[]>([]);
  const [gitCommitHistory, setGitCommitHistory] = useState<GitCommitSummary[]>([]);
  const [gitTags, setGitTags] = useState<GitTagSummary[]>([]);
  const [gitWorkingChanges, setGitWorkingChanges] = useState<GitWorkingChange[]>([]);
  const [selectedGitCommitHash, setSelectedGitCommitHash] = useState<string | null>(null);
  const [selectedGitCommitDiff, setSelectedGitCommitDiff] = useState<GitCommitDiff | null>(null);
  const [newGitBranchName, setNewGitBranchName] = useState("");
  const [newGitTagName, setNewGitTagName] = useState("");
  const [newGitTagMessage, setNewGitTagMessage] = useState("");
  const [gitRemoteUrl, setGitRemoteUrl] = useState("");
  const [gitSyncMessage, setGitSyncMessage] = useState<string | null>(null);
  const [gitErrorMessage, setGitErrorMessage] = useState<string | null>(null);
  const [gitRetryAction, setGitRetryAction] = useState<(() => void) | null>(null);
  const [pendingGitBranchSwitch, setPendingGitBranchSwitch] = useState<string | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = useState("");
  const [gitAuthorName, setGitAuthorName] = useState("");
  const [gitAuthorEmail, setGitAuthorEmail] = useState("");
  const [isCreatingGitBranch, setIsCreatingGitBranch] = useState(false);
  const [isCreatingGitCommit, setIsCreatingGitCommit] = useState(false);
  const [isCreatingGitTag, setIsCreatingGitTag] = useState(false);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isConnectingGitRemote, setIsConnectingGitRemote] = useState(false);
  const [isDeletingGitTag, setIsDeletingGitTag] = useState(false);
  const [isDisconnectingGitHub, setIsDisconnectingGitHub] = useState(false);
  const [isPullingGitBranch, setIsPullingGitBranch] = useState(false);
  const [isPushingGitBranch, setIsPushingGitBranch] = useState(false);
  const [pushingGitTagName, setPushingGitTagName] = useState<string | null>(null);
  const [isSwitchingGitBranch, setIsSwitchingGitBranch] = useState(false);
  const [gitCloneUrl, setGitCloneUrl] = useState("");
  const [isCloningGitHub, setIsCloningGitHub] = useState(false);
  const [gitSyncPreview, setGitSyncPreview] = useState<GitSyncPreview | null>(null);
  const [gitSyncStep, setGitSyncStep] = useState<"push-preview" | "pull-preview" | "pull-fetching" | null>(null);
  const [gitConflicts, setGitConflicts] = useState<GitConflict[]>([]);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [autoSyncSettings, setAutoSyncSettings] = useState<AutoSyncSettings>(defaultAutoSyncSettings);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(defaultFeatureToggles);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);

  const {
    editorSettings,
    focusedPane,
    isSplit,
    leftPane,
    rightPane,
    tabs,
    closeAllTabs,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabsInPane,
    openFileInPane,
    setEditorSettings,
    setFocusedPane,
    setTabActive,
    toggleSplit,
    updateTabMeta
  } = useEditorStore();

  const {
    activeSidebarView,
    isFocusMode,
    isRightPanelOpen,
    isSidebarOpen,
    isTypewriterMode,
    rightPanelView,
    setRightPanelView,
    setSidebarView,
    toggleFocusMode,
    toggleRightPanel,
    toggleSidebar,
    toggleTypewriterMode
  } = useUiStore();

  const t = useMemo(() => createTranslator(editorSettings.language), [editorSettings.language]);
  const sidebarViews = useMemo(
    () =>
      sidebarViewDefs.map((view) => ({
        ...view,
        label: t(view.labelKey)
      })),
    [t]
  );

  // テーマ適用
  useEffect(() => {
    function applyTheme(theme: AppTheme) {
      const root = document.documentElement;
      if (theme === "system") {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", theme);
      }
    }

    applyTheme(editorSettings.theme ?? "system");

    if ((editorSettings.theme ?? "system") === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [editorSettings.theme]);

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const sidebarResizingRef = useRef(false);
  const sidebarResizeStartXRef = useRef(0);
  const sidebarResizeStartWidthRef = useRef(0);

  const applyGitBranches = useCallback((branches: GitBranchSummary[]): void => {
    setGitBranches(branches);

    const currentBranch = branches.find((branch) => branch.isCurrent)?.name ?? null;

    setGitStatus((current) =>
      current
        ? {
            ...current,
            currentBranch
          }
        : current
    );
  }, []);

  // 初期ロード
  useEffect(() => {
    let canceled = false;

    void window.relic?.getAppInfo().then((result) => {
      if (canceled) return;
      if (result.ok) setAppInfo(result.value);
    });

    void window.relic?.getWorkspaceState().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic?.getEditorSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setEditorSettings(result.value);
    });

    void window.relic?.getGitHubAuthStatus().then((result) => {
      if (canceled) return;
      if (result.ok) setGitHubAuthStatus(result.value);
    });

    void window.relic?.getAutoSyncSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAutoSyncSettings(result.value);
    });

    void window.relic?.getFeatureToggles().then((result) => {
      if (canceled) return;
      if (result.ok) setFeatureToggles(result.value);
    });

    return () => { canceled = true; };
  }, [setEditorSettings]);

  // ──────────────────
  // ワークスペース操作
  // ──────────────────

  const handleOpenWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsOpeningWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .openWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsOpeningWorkspace(false));
  }, []);

  const handleCreateNewWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .createNewWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingWorkspace(false));
  }, []);

  const handleCreateFile = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void window.relic
      .createMarkdownFile({ name: fileNameDraft })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFile(false));
  }, [fileNameDraft]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!window.relic) return;

    void window.relic
      .createMarkdownFile({ name })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          const newFile = result.value.fileTree
            .flatMap(function flatten(n): string[] {
              return n.type === "file" ? [n.path] : n.children.flatMap(flatten);
            })
            .find((p) => p.endsWith(`${name}.md`));

          if (newFile) {
            void window.relic!.readMarkdownFile({ path: newFile }).then((r) => {
              if (r.ok) openFileInPane(focusedPane, r.value);
            });
          }
        } else {
          setWorkspaceError(result.error.message);
        }
      });
  }, [focusedPane, openFileInPane]);

  const handleCreateFolder = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void window.relic
      .createFolder({ name: folderNameDraft })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFolder(false));
  }, [folderNameDraft]);

  const handleOpenFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void window.relic.readMarkdownFile({ path }).then((result) => {
        if (result.ok) {
          openFileInPane(focusedPane, result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [focusedPane, openFileInPane]
  );

  const handleOpenWikiLink = useCallback(
    (target: string, heading?: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || !window.relic) return;

      const path = resolveWikiLinkPath(target, activeTab.path);
      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownFile({ path }).then((readResult) => {
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (heading) setScrollHeading(heading);
          return;
        }

        void window.relic!.createLinkedMarkdownFile({ path }).then((createResult) => {
          if (createResult.ok) {
            setWorkspaceState(createResult.value.workspaceState);
            openFileInPane(focusedPane, createResult.value.file);
          } else {
            setWorkspaceError(createResult.error.message);
          }
        });
      });
    },
    [focusedPane, leftPane, openFileInPane, rightPane, tabs]
  );

  const handleTagSearch = useCallback((tag: string): void => {
    setSearchMode("tag");
    setSearchQuery(tag);
    setSidebarView("search");
    if (!isSidebarOpen) toggleSidebar();
  }, [isSidebarOpen, setSidebarView, toggleSidebar]);

  const openFileInOtherPane = useCallback((fromPane: PaneId, tabId: string) => {
    const tab = tabs[tabId];
    if (!tab || !isSplit) return;
    const otherPane = fromPane === "left" ? "right" : "left";
    openFileInPane(otherPane, { content: tab.content, name: tab.name, path: tab.path });
  }, [tabs, isSplit, openFileInPane]);

  const handleSelectFolder = useCallback(
    (node: Extract<WorkspaceTreeNode, { type: "folder" }>): void => {
      void node; // フェーズ2ではフォルダ選択は何もしない
    },
    []
  );

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    if (!window.relic) return;

    void window.relic.switchWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        closeAllTabs();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeAllTabs]);

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
  }, [workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

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

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGitStatus(null);
      setGitBranches([]);
      setGitCommitHistory([]);
      setGitTags([]);
      setGitWorkingChanges([]);
      setPendingGitBranchSwitch(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitStatus().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitStatus(result.value);
      } else {
        setGitStatus(null);
        setSelectedGitCommitHash(null);
        setSelectedGitCommitDiff(null);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [workspaceState?.activeWorkspace?.id]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic || !gitStatus?.initialized) {
      setGitBranches([]);
      setGitCommitHistory([]);
      setGitRemotes([]);
      setGitTags([]);
      setGitWorkingChanges([]);
      setSelectedGitCommitHash(null);
      setSelectedGitCommitDiff(null);
      setPendingGitBranchSwitch(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitBranches().then((result) => {
      if (canceled) return;

      if (result.ok) {
        applyGitBranches(result.value);
      } else {
        setGitBranches([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitRemotes().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitRemotes(result.value);
        setGitRemoteUrl(result.value.find((remote) => remote.isOrigin)?.url ?? "");
      } else {
        setGitRemotes([]);
      }
    });

    void window.relic.getGitCommitHistory().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitCommitHistory(result.value);
        if (result.value.length > 0 && !selectedGitCommitHash) {
          setSelectedGitCommitHash(result.value[0].hash);
        }
      } else {
        setGitCommitHistory([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitTags().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitTags(result.value);
      } else {
        setGitTags([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitWorkingChanges().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitWorkingChanges(result.value);
      } else {
        setGitWorkingChanges([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [
    applyGitBranches,
    gitStatus?.initialized,
    selectedGitCommitHash,
    workspaceState?.activeWorkspace?.id,
    workspaceState?.fileTree
  ]);

  useEffect(() => {
    if (!window.relic || !selectedGitCommitHash || !gitStatus?.initialized) {
      setSelectedGitCommitDiff(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitCommitDiff(selectedGitCommitHash).then((result) => {
      if (canceled) return;

      if (result.ok) {
        setSelectedGitCommitDiff(result.value);
      } else {
        setSelectedGitCommitDiff(null);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [gitStatus?.initialized, selectedGitCommitHash]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!e.metaKey) return;

      if (e.shiftKey && e.key === "P") {
        e.preventDefault();
        setShowQuickSwitcher(false);
        setShowCommandPalette((v) => !v);
      } else if (!e.shiftKey && e.key === "p") {
        e.preventDefault();
        setShowCommandPalette(false);
        setShowQuickSwitcher((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // ──────────────────
  // エディタ設定保存
  // ──────────────────

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      setEditorSettings(settings);
      void window.relic?.saveEditorSettings(settings);
    },
    [setEditorSettings]
  );

  const refreshGitWorkingChanges = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitWorkingChanges().then((result) => {
      if (result.ok) {
        setGitWorkingChanges(result.value);
      } else {
        setGitWorkingChanges([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const refreshGitCommitHistory = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitCommitHistory().then((result) => {
      if (result.ok) {
        setGitCommitHistory(result.value);
        setSelectedGitCommitHash((current) => {
          if (result.value.length === 0) {
            return null;
          }

          return current && result.value.some((commit) => commit.hash === current)
            ? current
            : result.value[0].hash;
        });
      } else {
        setGitCommitHistory([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const refreshGitTags = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitTags().then((result) => {
      if (result.ok) {
        setGitTags(result.value);
      } else {
        setGitTags([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const refreshGitBranches = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitBranches().then((result) => {
      if (result.ok) {
        applyGitBranches(result.value);
      } else {
        setGitBranches([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, [applyGitBranches]);

  const handleInitializeGitRepository = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.initializeGitRepository().then((result) => {
      if (result.ok) {
        setGitStatus(result.value);
        setPendingGitBranchSwitch(null);
        setWorkspaceError(null);
        refreshGitBranches();
        refreshGitCommitHistory();
        refreshGitTags();
        refreshGitWorkingChanges();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [refreshGitBranches, refreshGitCommitHistory, refreshGitTags, refreshGitWorkingChanges]);

  const handleCreateGitBranch = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitBranch(true);
    setWorkspaceError(null);

    void window.relic
      .createGitBranch({ name: newGitBranchName })
      .then((result) => {
        if (result.ok) {
          applyGitBranches(result.value);
          setNewGitBranchName("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingGitBranch(false));
  }, [applyGitBranches, newGitBranchName]);

  const handleSwitchGitBranch = useCallback(
    (name: string, allowDirty = false): void => {
      if (!window.relic) return;

      setIsSwitchingGitBranch(true);
      setWorkspaceError(null);

      void window.relic
        .switchGitBranch({ allowDirty, name })
        .then((result) => {
          if (result.ok) {
            applyGitBranches(result.value);
            setPendingGitBranchSwitch(null);
            refreshGitCommitHistory();
            refreshGitWorkingChanges();
            return;
          }

          if (result.error.code === "GIT_BRANCH_SWITCH_DIRTY") {
            setPendingGitBranchSwitch(name);
            return;
          }

          setWorkspaceError(result.error.message);
        })
        .finally(() => setIsSwitchingGitBranch(false));
    },
    [applyGitBranches, refreshGitCommitHistory, refreshGitWorkingChanges]
  );

  const handleCreateGitCommit = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitCommit(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        authorEmail: gitAuthorEmail,
        authorName: gitAuthorName,
        message: gitCommitMessage
      })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitCommitMessage("");
        setGitCommitHistory((current) => [result.value, ...current]);
        setSelectedGitCommitHash(result.value.hash);
        setPendingGitBranchSwitch(null);
        refreshGitWorkingChanges();
      })
      .finally(() => setIsCreatingGitCommit(false));
  }, [gitAuthorEmail, gitAuthorName, gitCommitMessage, refreshGitWorkingChanges]);

  const handleCreateGitTag = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitTag(true);
    setWorkspaceError(null);

    void window.relic
      .createGitTag({
        hash: selectedGitCommitHash ?? undefined,
        message: newGitTagMessage,
        name: newGitTagName,
        taggerEmail: gitAuthorEmail,
        taggerName: gitAuthorName
      })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitTags(result.value);
        setNewGitTagName("");
        setNewGitTagMessage("");
      })
      .finally(() => setIsCreatingGitTag(false));
  }, [gitAuthorEmail, gitAuthorName, newGitTagMessage, newGitTagName, selectedGitCommitHash]);

  const handleDeleteGitTag = useCallback((name: string): void => {
    if (!window.relic) return;

    setIsDeletingGitTag(true);
    setWorkspaceError(null);

    void window.relic
      .deleteGitTag({ name })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitTags(result.value);
      })
      .finally(() => setIsDeletingGitTag(false));
  }, []);

  const handleCommitAndSwitchGitBranch = useCallback((): void => {
    if (!window.relic || !pendingGitBranchSwitch) return;

    setIsCreatingGitCommit(true);
    setIsSwitchingGitBranch(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        authorEmail: gitAuthorEmail,
        authorName: gitAuthorName,
        message: gitCommitMessage
      })
      .then((commitResult) => {
        if (!commitResult.ok) {
          setWorkspaceError(commitResult.error.message);
          return;
        }

        setGitCommitMessage("");
        setGitCommitHistory((current) => [commitResult.value, ...current]);
        setSelectedGitCommitHash(commitResult.value.hash);

        return window.relic!.switchGitBranch({ name: pendingGitBranchSwitch });
      })
      .then((switchResult) => {
        if (!switchResult) {
          return;
        }

        if (switchResult.ok) {
          applyGitBranches(switchResult.value);
          setPendingGitBranchSwitch(null);
          refreshGitCommitHistory();
          refreshGitWorkingChanges();
        } else {
          setWorkspaceError(switchResult.error.message);
        }
      })
      .finally(() => {
        setIsCreatingGitCommit(false);
        setIsSwitchingGitBranch(false);
      });
  }, [
    applyGitBranches,
    gitAuthorEmail,
    gitAuthorName,
    gitCommitMessage,
    pendingGitBranchSwitch,
    refreshGitCommitHistory,
    refreshGitWorkingChanges
  ]);

  const handleConnectGitHubAccount = useCallback((): void => {
    if (!window.relic) return;

    setIsConnectingGitHub(true);
    setWorkspaceError(null);

    void window.relic
      .connectGitHubAccount()
      .then((result) => {
        if (result.ok) {
          setGitHubAuthStatus(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsConnectingGitHub(false));
  }, []);

  const handleDisconnectGitHubAccount = useCallback((): void => {
    if (!window.relic) return;

    setIsDisconnectingGitHub(true);
    setWorkspaceError(null);

    void window.relic
      .disconnectGitHubAccount()
      .then((result) => {
        if (result.ok) {
          setGitHubAuthStatus(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsDisconnectingGitHub(false));
  }, []);

  const handleConnectGitRemote = useCallback((): void => {
    if (!window.relic) return;

    setIsConnectingGitRemote(true);
    setGitSyncMessage(null);
    setWorkspaceError(null);

    void window.relic
      .connectGitRemote({ url: gitRemoteUrl })
      .then((result) => {
        if (result.ok) {
          setGitRemotes(result.value);
          setGitRemoteUrl(result.value.find((remote) => remote.isOrigin)?.url ?? gitRemoteUrl);
          setGitSyncMessage(t("git.remoteConnected"));
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsConnectingGitRemote(false));
  }, [gitRemoteUrl, t]);

  const clearGitMessages = (): void => {
    setGitSyncMessage(null);
    setGitErrorMessage(null);
    setGitRetryAction(null);
  };

  const handleShowPushPreview = useCallback((): void => {
    if (!window.relic) return;

    clearGitMessages();
    setGitSyncStep("pull-fetching");

    void window.relic
      .getGitSyncPreview()
      .then((result) => {
        if (result.ok) {
          setGitSyncPreview(result.value);
          setGitSyncStep("push-preview");
        } else {
          setGitSyncStep(null);
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleShowPushPreview);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowPullPreview = useCallback((): void => {
    if (!window.relic) return;

    clearGitMessages();
    setGitSyncStep("pull-fetching");

    void window.relic
      .getGitSyncPreview()
      .then((result) => {
        if (result.ok) {
          setGitSyncPreview(result.value);
          setGitSyncStep("pull-preview");
        } else {
          setGitSyncStep(null);
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleShowPullPreview);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmPush = useCallback((): void => {
    if (!window.relic) return;

    setIsPushingGitBranch(true);
    setGitSyncStep(null);

    void window.relic
      .pushGitBranch()
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
          refreshGitWorkingChanges();
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleConfirmPush);
        }
      })
      .finally(() => setIsPushingGitBranch(false));
  }, [refreshGitWorkingChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmPull = useCallback((): void => {
    if (!window.relic) return;

    setIsPullingGitBranch(true);
    setGitSyncStep(null);

    void window.relic
      .pullGitBranch()
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
          refreshGitCommitHistory();
          refreshGitWorkingChanges();
          void window.relic?.getGitConflicts().then((r) => {
            if (r.ok) setGitConflicts(r.value);
          });
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleConfirmPull);
          void window.relic?.getGitConflicts().then((r) => {
            if (r.ok) setGitConflicts(r.value);
          });
        }
      })
      .finally(() => setIsPullingGitBranch(false));
  }, [refreshGitCommitHistory, refreshGitWorkingChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolveConflict = useCallback((filePath: string, resolution: "ours" | "theirs"): void => {
    if (!window.relic) return;

    setIsResolvingConflict(true);

    void window.relic
      .resolveGitConflict({ path: filePath, resolution })
      .then((result) => {
        if (result.ok) {
          setGitConflicts(result.value);
          refreshGitWorkingChanges();
        } else {
          setGitErrorMessage(result.error.message);
        }
      })
      .finally(() => setIsResolvingConflict(false));
  }, [refreshGitWorkingChanges]);

  const handleCloneGitHubRepository = useCallback((): void => {
    if (!window.relic) return;

    setIsCloningGitHub(true);
    setGitErrorMessage(null);

    void window.relic
      .cloneGitHubRepository({ url: gitCloneUrl })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setGitCloneUrl("");
        } else {
          setGitErrorMessage(result.error.message);
        }
      })
      .finally(() => setIsCloningGitHub(false));
  }, [gitCloneUrl]);

  const handleSaveAutoSyncSettings = useCallback((settings: AutoSyncSettings): void => {
    setAutoSyncSettings(settings);
    void window.relic?.saveAutoSyncSettings(settings);
  }, []);

  const handleSaveFeatureToggles = useCallback((toggles: FeatureToggles): void => {
    setFeatureToggles(toggles);
    void window.relic?.saveFeatureToggles(toggles);
  }, []);

  const handlePushGitBranch = (): void => { handleShowPushPreview(); };
  const handlePullGitBranch = (): void => { handleShowPullPreview(); };

  const handlePushGitTag = useCallback((name: string): void => {
    if (!window.relic) return;

    setPushingGitTagName(name);
    clearGitMessages();

    void window.relic
      .pushGitTag({ name })
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => () => handlePushGitTag(name));
        }
      })
      .finally(() => setPushingGitTagName(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────
  // ファイル移動
  // ──────────────────

  const handleTogglePin = useCallback((path: string): void => {
    if (!window.relic) return;

    void window.relic.togglePin(path).then((result) => {
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    });
  }, []);

  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveMarkdownFile({ destinationFolder: destFolder, path }).then((result) => {
      if (result.ok) {
        const oldTab = Object.entries(tabs).find(([, t]) => t.path === path);

        if (oldTab) updateTabMeta(oldTab[0], { name: result.value.file.name, path: result.value.file.path });
        setWorkspaceState(result.value.workspaceState);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [tabs, updateTabMeta]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveFolder({ destinationFolder: destFolder, path }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const handleMoveActiveFile = useCallback(
    (destinationFolder: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const tabId = paneState.activeTabId;

      if (!tabId || !window.relic) return;

      const tab = tabs[tabId];

      if (!tab) return;

      void window.relic
        .moveMarkdownFile({ destinationFolder, path: tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, tabs, updateTabMeta]
  );

  const handleRefreshWorkspaceState = useCallback((): void => {
    void window.relic?.getWorkspaceState().then((result) => {
      if (result.ok) setWorkspaceState(result.value);
    });
  }, []);

  const handleCreateFrontmatterTemplate = useCallback((): void => {
    void window.relic?.createFrontmatterTemplate().then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  // ──────────────────
  // ファイル名リネーム（タブのメタ更新）
  // ──────────────────

  const handleRenameActiveFile = useCallback(
    (newName: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const tabId = paneState.activeTabId;

      if (!tabId || !window.relic) return;

      const tab = tabs[tabId];

      if (!tab) return;

      void window.relic
        .renameMarkdownFile({ newName, path: tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, tabs, updateTabMeta]
  );

  const handleDuplicateActiveFile = useCallback((): void => {
    const paneState = focusedPane === "left" ? leftPane : rightPane;
    const tabId = paneState.activeTabId;
    if (!tabId || !window.relic) return;
    const tab = tabs[tabId];
    if (!tab) return;
    void window.relic.duplicateMarkdownFile({ path: tab.path }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, leftPane, rightPane, tabs, openFileInPane]);

  const handleDeleteActiveFile = useCallback((): void => {
    const paneState = focusedPane === "left" ? leftPane : rightPane;
    const tabId = paneState.activeTabId;
    if (!tabId || !window.relic) return;
    const tab = tabs[tabId];
    if (!tab) return;
    if (!window.confirm(`「${tab.name}」をゴミ箱に移動しますか？`)) return;
    void window.relic.moveItemToTrash({ path: tab.path, type: "file" }).then((result) => {
      if (result.ok) {
        closeTab(focusedPane, tabId);
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, leftPane, rightPane, tabs, closeTab]);

  // ──────────────────
  // キーボードショートカット
  // ──────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.metaKey) return;

      if (e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "\\") {
        e.preventDefault();
        toggleSplit();
      } else if (e.key === "b" && e.shiftKey) {
        e.preventDefault();
        toggleRightPanel();
      } else if (e.key === "w") {
        e.preventDefault();
        const paneState = focusedPane === "left" ? leftPane : rightPane;
        if (paneState.activeTabId) closeTab(focusedPane, paneState.activeTabId);
      } else if (e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        setSidebarView("search");
        if (!isSidebarOpen) toggleSidebar();
      } else if (e.key === "f" && e.shiftKey) {
        e.preventDefault();
        setSidebarView("search");
        if (!isSidebarOpen) toggleSidebar();
      } else if (e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        setSidebarView("files");
        if (!isSidebarOpen) toggleSidebar();
        setIsCreatingFile(true);
      } else if (e.key === "T" && e.shiftKey) {
        e.preventDefault();
        toggleTypewriterMode();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [focusedPane, isSidebarOpen, leftPane, rightPane, closeTab, setSidebarView, toggleSidebar, toggleSplit, toggleRightPanel, setIsCreatingFile, toggleTypewriterMode]);

  // ──────────────────
  // サイドバーリサイズ
  // ──────────────────

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!sidebarResizingRef.current) return;
      const delta = e.clientX - sidebarResizeStartXRef.current;
      const next = Math.max(180, Math.min(500, sidebarResizeStartWidthRef.current + delta));
      setSidebarWidth(next);
    };
    const handleMouseUp = (): void => {
      sidebarResizingRef.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // ──────────────────
  // アクティブなパスのセット（ファイルツリーのハイライト用）
  // ──────────────────

  const activePaths = new Set(Object.values(tabs).map((t) => t.path));
  const existingMarkdownPaths = useMemo(
    () => collectMarkdownPaths(workspaceState?.fileTree ?? []),
    [workspaceState?.fileTree]
  );

  // ──────────────────
  // アウトライン（右パネル）
  // ──────────────────

  const activeTabInFocusedPane = (() => {
    const paneState = focusedPane === "left" ? leftPane : rightPane;

    return paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  })();

  const outlineHeadings = activeTabInFocusedPane
    ? activeTabInFocusedPane.content
        .split("\n")
        .filter((line) => /^#{1,6} /.test(line))
        .map((line) => {
          const match = /^(#{1,6}) (.+)/.exec(line);

          return match ? { level: match[1].length, text: match[2] } : null;
        })
        .filter(Boolean)
    : [];
  const outgoingLinks = activeTabInFocusedPane
    ? resolveWikiLinks(activeTabInFocusedPane.content, activeTabInFocusedPane.path, existingMarkdownPaths)
    : [];

  useEffect(() => {
    if (!activeTabInFocusedPane || !window.relic) {
      setBacklinks([]);
      return;
    }

    let canceled = false;
    setIsLoadingBacklinks(true);

    void window.relic
      .getBacklinks({ path: activeTabInFocusedPane.path })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setBacklinks(result.value);
        } else {
          setBacklinks([]);
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => {
        if (!canceled) setIsLoadingBacklinks(false);
      });

    return () => {
      canceled = true;
    };
  }, [activeTabInFocusedPane?.path, workspaceState?.fileTree]);

  // ──────────────────
  // コマンドパレット
  // ──────────────────

  const commands: Command[] = [
    {
      id: "new-note",
      label: t("pane.createNote"),
      shortcut: "⌘N",
      action: () => { setSidebarView("files"); if (!isSidebarOpen) toggleSidebar(); setIsCreatingFile(true); }
    },
    {
      id: "search",
      label: t("command.search"),
      shortcut: "⌘F",
      action: () => { setSidebarView("search"); if (!isSidebarOpen) toggleSidebar(); }
    },
    {
      id: "quick-switcher",
      label: t("command.quickSwitcher"),
      shortcut: "⌘P",
      action: () => setShowQuickSwitcher(true)
    },
    {
      id: "toggle-sidebar",
      label: t("command.sidebar"),
      shortcut: "⌘B",
      action: toggleSidebar
    },
    {
      id: "toggle-split",
      label: t("command.split"),
      shortcut: "⌘\\",
      action: toggleSplit
    },
    {
      id: "toggle-right-panel",
      label: t("command.rightPanel"),
      shortcut: "⌘⇧B",
      action: toggleRightPanel
    },
    {
      id: "toggle-focus",
      label: t("command.focusMode"),
      action: toggleFocusMode
    },
    {
      id: "toggle-typewriter",
      label: t("command.typewriter"),
      shortcut: "⌘⇧T",
      action: toggleTypewriterMode
    },
    {
      id: "git",
      label: t("command.gitView"),
      action: () => { setSidebarView("git"); if (!isSidebarOpen) toggleSidebar(); }
    },
    {
      id: "git-push",
      label: t("command.gitPush"),
      action: () => { setSidebarView("git"); if (!isSidebarOpen) toggleSidebar(); handlePushGitBranch(); }
    },
    {
      id: "git-pull",
      label: t("command.gitPull"),
      action: () => { setSidebarView("git"); if (!isSidebarOpen) toggleSidebar(); handlePullGitBranch(); }
    },
    ...(gitBranches.length > 1
      ? gitBranches
          .filter((b) => !b.isCurrent)
          .map((b) => ({
            id: `git-branch-${b.name}`,
            label: t("command.branchSwitch", { name: b.name }),
            action: () => { setSidebarView("git"); if (!isSidebarOpen) toggleSidebar(); handleSwitchGitBranch(b.name); }
          }))
      : []),
    ...(activeTabInFocusedPane
      ? [
          {
            id: "rename-file",
            label: t("command.renameFile", { name: activeTabInFocusedPane.name }),
            action: () => {
              setSidebarView("files");
              if (!isSidebarOpen) toggleSidebar();
            }
          },
          {
            id: "duplicate-file",
            label: t("command.duplicateFile", { name: activeTabInFocusedPane.name }),
            action: handleDuplicateActiveFile
          },
          {
            id: "delete-file",
            label: t("command.deleteFile", { name: activeTabInFocusedPane.name }),
            action: handleDeleteActiveFile
          }
        ]
      : []),
    {
      id: "settings",
      label: t("command.settings"),
      action: () => { setSidebarView("settings"); if (!isSidebarOpen) toggleSidebar(); }
    }
  ];

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className={`app-shell${isFocusMode ? " app-shell--focus" : ""}`}>
      <div className="title-bar" />
      <div className="workspace">
        {/* 縦アイコンナビ（レール） */}
        <nav aria-label={t("nav.viewSwitcher")} className="rail">
          <button
            aria-label={t("pane.toggleSidebar")}
            className="rail-button"
            onClick={toggleSidebar}
            title={t("pane.toggleSidebarShortcut")}
            type="button"
          >
            {isSidebarOpen ? (
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 16 16" width="16">
                <polyline points="10,3 5,8 10,13" />
              </svg>
            ) : (
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 16 16" width="16">
                <polyline points="6,3 11,8 6,13" />
              </svg>
            )}
          </button>
          <div className="rail-separator" />
          {sidebarViews
            .filter((view) => {
              if (view.id === "git" && !featureToggles.git) return false;
              if (view.id === "tools" && !featureToggles.tools) return false;
              return true;
            })
            .map((view) => (
              <button
                aria-label={view.label}
                className={`rail-button${view.id === activeSidebarView ? " active" : ""}`}
                key={view.id}
                onClick={() => setSidebarView(view.id)}
                title={view.label}
                type="button"
              >
                {view.icon}
              </button>
            ))}
        </nav>

        {/* サイドバー */}
        {isSidebarOpen ? (
          <aside className="sidebar" style={{ width: sidebarWidth }}>
            <div className="pane-heading">
              {sidebarViews.find((v) => v.id === activeSidebarView)?.label}
            </div>
            {activeSidebarView === "files" ? (
              <FilesSidebar
                activePaths={activePaths}
                fileNameDraft={fileNameDraft}
                folderNameDraft={folderNameDraft}
                isCreatingFile={isCreatingFile}
                isCreatingFolder={isCreatingFolder}
                isCreatingWorkspace={isCreatingWorkspace}
                isOpeningWorkspace={isOpeningWorkspace}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onCreateWorkspace={handleCreateNewWorkspace}
                onFileNameDraftChange={setFileNameDraft}
                onFolderNameDraftChange={setFolderNameDraft}
                onMoveFile={handleMoveFile}
                onMoveFolder={handleMoveFolder}
                onOpenFile={handleOpenFile}
                onOpenWorkspace={handleOpenWorkspace}
                onSelectFolder={handleSelectFolder}
                onSwitchWorkspace={handleSwitchWorkspace}
                onTogglePin={handleTogglePin}
                workspaceState={workspaceState}
              />
            ) : activeSidebarView === "search" ? (
              <SearchSidebar
                activeFilePath={activeTabInFocusedPane?.path ?? null}
                error={searchError}
                frontmatterCandidates={frontmatterCandidates}
                frontmatterField={searchFrontmatterField}
                mode={searchMode}
                onFrontmatterFieldChange={setSearchFrontmatterField}
                onModeChange={setSearchMode}
                onOpenFile={handleOpenFile}
                onQueryChange={setSearchQuery}
                onTagSelect={(tag) => {
                  setSearchMode("tag");
                  setSearchQuery(tag);
                }}
                onWorkspaceChange={handleRefreshWorkspaceState}
                query={searchQuery}
                results={searchResults}
                tags={workspaceTags}
              />
            ) : activeSidebarView === "git" ? (
              <div className="sidebar-section">
                {!workspaceState?.activeWorkspace ? (
                  <div className="empty-note">{t("empty.noWorkspaceGit")}</div>
                ) : gitStatus?.initialized ? (
                  <>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.github")}</div>
                      {gitHubAuthStatus?.connected ? (
                        <>
                          <div className="setting-row">
                            <span>{t("git.connection")}</span>
                            <span>{t("git.connected")}</span>
                          </div>
                          <div className="setting-row">
                            <span>{t("git.account")}</span>
                            <span>{gitHubAuthStatus.login ?? "-"}</span>
                          </div>
                          <div className="setting-row">
                            <span>{t("git.scopes")}</span>
                            <span>
                              {gitHubAuthStatus.scopes.length > 0
                                ? gitHubAuthStatus.scopes.join(", ")
                                : "-"}
                            </span>
                          </div>
                          <button
                            className="replace-btn"
                            disabled={isDisconnectingGitHub}
                            onClick={handleDisconnectGitHubAccount}
                            type="button"
                          >
                            {isDisconnectingGitHub ? t("git.disconnectingAccount") : t("git.disconnectAccount")}
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="empty-note">
                            {t("git.connectHint")}
                          </div>
                          {!gitHubAuthStatus?.configured ? (
                            <div className="search-result-line">
                              {t("git.connectRequired")}
                            </div>
                          ) : null}
                          <button
                            className="primary-button"
                            disabled={isConnectingGitHub || gitHubAuthStatus?.configured === false}
                            onClick={handleConnectGitHubAccount}
                            type="button"
                          >
                            {isConnectingGitHub ? t("git.connectingAccount") : t("git.connectAccount")}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.remote")}</div>
                      <form
                        className="git-branch-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleConnectGitRemote();
                        }}
                      >
                        <input
                          aria-label={t("git.originUrl")}
                          className="text-input"
                          onChange={(event) => setGitRemoteUrl(event.target.value)}
                          placeholder="https://github.com/owner/repo"
                          value={gitRemoteUrl}
                        />
                        <button
                          className="primary-button"
                          disabled={isConnectingGitRemote}
                          type="submit"
                        >
                          {isConnectingGitRemote ? t("git.connectingOrigin") : t("git.connectOrigin")}
                        </button>
                      </form>
                      {gitRemotes.length > 0 ? (
                        <ul className="search-results">
                          {gitRemotes.map((remote) => (
                            <li className="search-result-item" key={remote.name}>
                              <div className="search-result-button">
                                <span className="search-result-title">
                                  {remote.name}
                                  {remote.isOrigin ? " (origin)" : ""}
                                </span>
                                <span className="search-result-line">{remote.url}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">No GitHub repository connected yet.</div>
                      )}
                      {gitSyncStep === "pull-fetching" ? (
                        <div className="empty-note">Checking GitHub changes...</div>
                      ) : gitSyncStep === "push-preview" && gitSyncPreview ? (
                        <div className="git-sync-preview">
                          <div className="links-panel-subheading">{t("git.outgoingChanges")}</div>
                          {gitSyncPreview.outgoingChanges.length > 0 ? (
                            <ul className="search-results">
                              {gitSyncPreview.outgoingChanges.map((c) => (
                                <li className="search-result-item" key={c.path}>
                                  <div className="search-result-button">
                                    <span className="search-result-title">{c.path}</span>
                                    <span className="search-result-line">{c.status}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="empty-note">{t("git.noChanges")}</div>
                          )}
                          {gitSyncPreview.incomingCommits.length > 0 ? (
                            <>
                              <div className="links-panel-subheading">{t("git.incomingCommits")}</div>
                              <ul className="search-results">
                                {gitSyncPreview.incomingCommits.map((c) => (
                                  <li className="search-result-item" key={c.hash}>
                                    <div className="search-result-button">
                                      <span className="search-result-title">{c.message}</span>
                                      <span className="search-result-line">{c.author}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                          <div className="git-branch-warning-actions">
                            <button
                              className="primary-button"
                              disabled={isPushingGitBranch}
                              onClick={handleConfirmPush}
                              type="button"
                            >
                              {isPushingGitBranch ? t("git.pushing") : t("git.push")}
                            </button>
                            <button
                              className="replace-btn"
                              onClick={() => setGitSyncStep(null)}
                              type="button"
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : gitSyncStep === "pull-preview" && gitSyncPreview ? (
                        <div className="git-sync-preview">
                          <div className="links-panel-subheading">{t("git.incomingCommits")}</div>
                          {gitSyncPreview.incomingCommits.length > 0 ? (
                            <ul className="search-results">
                              {gitSyncPreview.incomingCommits.map((c) => (
                                <li className="search-result-item" key={c.hash}>
                                  <div className="search-result-button">
                                    <span className="search-result-title">{c.message}</span>
                                    <span className="search-result-line">{c.author}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="empty-note">{t("git.noIncoming")}</div>
                          )}
                          {gitSyncPreview.outgoingChanges.length > 0 ? (
                            <>
                              <div className="links-panel-subheading">{t("git.uncommittedChanges")}</div>
                              <ul className="search-results">
                                {gitSyncPreview.outgoingChanges.map((c) => (
                                  <li className="search-result-item" key={c.path}>
                                    <div className="search-result-button">
                                      <span className="search-result-title">{c.path}</span>
                                      <span className="search-result-line">{c.status}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : null}
                          <div className="git-branch-warning-actions">
                            <button
                              className="primary-button"
                              disabled={isPullingGitBranch}
                              onClick={handleConfirmPull}
                              type="button"
                            >
                              {isPullingGitBranch ? t("git.pulling") : t("git.pull")}
                            </button>
                            <button
                              className="replace-btn"
                              onClick={() => setGitSyncStep(null)}
                              type="button"
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="git-branch-warning-actions">
                          <button
                            className="replace-btn"
                            disabled={isPullingGitBranch || !gitHubAuthStatus?.connected || gitRemotes.length === 0}
                            onClick={handlePullGitBranch}
                            type="button"
                          >
                            Pull
                          </button>
                          <button
                            className="primary-button"
                            disabled={isPushingGitBranch || !gitHubAuthStatus?.connected || gitRemotes.length === 0}
                            onClick={handlePushGitBranch}
                            type="button"
                          >
                            Push
                          </button>
                        </div>
                      )}
                      {gitSyncMessage ? <div className="search-result-line">{gitSyncMessage}</div> : null}
                      {gitErrorMessage ? (
                        <div className="git-error-block">
                          <div className="error-note">{gitErrorMessage}</div>
                          {gitRetryAction ? (
                            <button className="replace-btn" onClick={gitRetryAction} type="button">
                              {t("git.retry")}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {gitConflicts.length > 0 ? (
                      <div className="search-block">
                        <div className="links-panel-subheading">{t("git.conflicts")}</div>
                        <div className="error-note">
                          {t("git.conflictPrompt")}
                        </div>
                        <ul className="search-results">
                          {gitConflicts.map((conflict) => (
                            <li className="search-result-item" key={conflict.path}>
                              <div className="search-result-button">
                                <span className="search-result-title">{conflict.path}</span>
                              </div>
                              <div className="git-branch-warning-actions">
                                <button
                                  className="replace-btn"
                                  disabled={isResolvingConflict}
                                  onClick={() => handleResolveConflict(conflict.path, "ours")}
                                  type="button"
                                >
                                  {t("git.conflictChooseOurs")}
                                </button>
                                <button
                                  className="replace-btn"
                                  disabled={isResolvingConflict}
                                  onClick={() => handleResolveConflict(conflict.path, "theirs")}
                                  type="button"
                                >
                                  {t("git.conflictChooseTheirs")}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.repository")}</div>
                      <div className="setting-row">
                        <span>{t("git.status")}</span>
                        <span>{t("git.initialized")}</span>
                      </div>
                      <div className="setting-row">
                        <span>{t("git.branch")}</span>
                        <span>{gitStatus.currentBranch ?? "(detached)"}</span>
                      </div>
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.branches")}</div>
                      <form
                        className="git-branch-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleCreateGitBranch();
                        }}
                      >
                        <input
                          aria-label={t("git.branchName")}
                          className="text-input"
                          onChange={(event) => setNewGitBranchName(event.target.value)}
                          placeholder="feature/..."
                          value={newGitBranchName}
                        />
                        <button
                          className="primary-button"
                          disabled={isCreatingGitBranch}
                          type="submit"
                        >
                          {isCreatingGitBranch ? t("git.branchCreating") : t("git.branchCreate")}
                        </button>
                      </form>
                      {gitBranches.length > 0 ? (
                        <ul className="search-results git-branch-list">
                          {gitBranches.map((branch) => (
                            <li className="search-result-item" key={branch.name}>
                              <button
                                className="search-result-button"
                                disabled={branch.isCurrent || isSwitchingGitBranch}
                                onClick={() => handleSwitchGitBranch(branch.name)}
                                type="button"
                              >
                                <span className="search-result-title">
                                  {branch.name}
                                  {branch.isCurrent ? " (current)" : ""}
                                </span>
                                <span className="search-result-line">
                                  {branch.isCurrent ? t("git.currentBranch") : t("git.switch")}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("git.noBranches")}</div>
                      )}
                      {pendingGitBranchSwitch ? (
                        <div className="git-branch-warning">
                          <div className="error-note">
                            Uncommitted changes exist. Choose how to switch to `{pendingGitBranchSwitch}`.
                          </div>
                          <div className="git-branch-warning-actions">
                            <button
                              className="primary-button"
                              disabled={isCreatingGitCommit || isSwitchingGitBranch}
                              onClick={handleCommitAndSwitchGitBranch}
                              type="button"
                            >
                              {t("git.switchCommit")}
                            </button>
                            <button
                              className="replace-btn"
                              disabled={isSwitchingGitBranch}
                              onClick={() => handleSwitchGitBranch(pendingGitBranchSwitch, true)}
                              type="button"
                            >
                              {t("git.switchAllowDirty")}
                            </button>
                            <button
                              className="replace-btn"
                              disabled={isCreatingGitCommit || isSwitchingGitBranch}
                              onClick={() => setPendingGitBranchSwitch(null)}
                              type="button"
                            >
                              {t("common.cancel")}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.commit")}</div>
                      <input
                        aria-label={t("git.authorName")}
                        className="text-input"
                        onChange={(event) => setGitAuthorName(event.target.value)}
                        placeholder={t("git.authorName")}
                        value={gitAuthorName}
                      />
                      <input
                        aria-label={t("git.authorEmail")}
                        className="text-input"
                        onChange={(event) => setGitAuthorEmail(event.target.value)}
                        placeholder="author@example.com"
                        value={gitAuthorEmail}
                      />
                      <input
                        aria-label={t("git.commitMessage")}
                        className="text-input"
                        onChange={(event) => setGitCommitMessage(event.target.value)}
                        placeholder={t("git.commitMessage")}
                        value={gitCommitMessage}
                      />
                      <button
                        className="primary-button"
                        disabled={isCreatingGitCommit}
                        onClick={handleCreateGitCommit}
                        type="button"
                      >
                        {isCreatingGitCommit ? t("git.commitCreating") : t("git.commitCreate")}
                      </button>
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.changes")}</div>
                      {gitWorkingChanges.length > 0 ? (
                        <ul className="search-results">
                          {gitWorkingChanges.map((change) => (
                            <li className="search-result-item" key={`${change.status}-${change.path}`}>
                              <div className="search-result-button">
                                <span className="search-result-title">{change.path}</span>
                                <span className="search-result-line">{change.status}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("git.noUncommitted")}</div>
                      )}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.history")}</div>
                      {gitCommitHistory.length > 0 ? (
                        <ul className="search-results">
                          {gitCommitHistory.map((commit) => (
                            <li className="search-result-item" key={commit.hash}>
                              <button
                                className="search-result-button"
                                onClick={() => setSelectedGitCommitHash(commit.hash)}
                                type="button"
                              >
                                <span className="search-result-title">{commit.message}</span>
                                <span className="search-result-line">
                                  {commit.author} · {new Date(commit.date).toLocaleString("ja-JP")}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("git.commitHistoryEmpty")}</div>
                      )}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.tags")}</div>
                      <div className="git-tag-target">
                        {selectedGitCommitHash
                          ? t("git.tagTarget", { hash: selectedGitCommitHash.slice(0, 7) })
                          : t("git.selectCommitForTag")}
                      </div>
                      <input
                        aria-label={t("git.tagName")}
                        className="text-input"
                        onChange={(event) => setNewGitTagName(event.target.value)}
                        placeholder="v1.0.0"
                        value={newGitTagName}
                      />
                      <input
                        aria-label={t("git.tagMemo")}
                        className="text-input"
                        onChange={(event) => setNewGitTagMessage(event.target.value)}
                        placeholder={t("git.tagMemoPlaceholder")}
                        value={newGitTagMessage}
                      />
                      <button
                        className="primary-button"
                        disabled={isCreatingGitTag || !selectedGitCommitHash}
                        onClick={handleCreateGitTag}
                        type="button"
                      >
                        {isCreatingGitTag ? t("git.tagCreating") : t("git.tagCreate")}
                      </button>
                      {gitTags.length > 0 ? (
                        <ul className="search-results git-tag-list">
                          {gitTags.map((tag) => (
                            <li className="search-result-item" key={tag.name}>
                              <div className="git-tag-row">
                                <button
                                  className="search-result-button"
                                  onClick={() => setSelectedGitCommitHash(tag.targetHash)}
                                  type="button"
                                >
                                  <span className="search-result-title">
                                    {tag.name}
                                    {tag.annotated ? " (annotated)" : ""}
                                  </span>
                                  <span className="search-result-line">
                                    {tag.targetHash.slice(0, 7)} · {new Date(tag.date).toLocaleString("ja-JP")}
                                  </span>
                                  {tag.message ? (
                                    <span className="search-result-line">{tag.message}</span>
                                  ) : tag.targetMessage ? (
                                    <span className="search-result-line">{tag.targetMessage}</span>
                                  ) : null}
                                </button>
                                <button
                                  className="replace-btn"
                                  disabled={isDeletingGitTag}
                                  onClick={() => handleDeleteGitTag(tag.name)}
                                  type="button"
                                >
                                  {t("git.tagDelete")}
                                </button>
                                <button
                                  className="replace-btn"
                                  disabled={
                                    pushingGitTagName === tag.name ||
                                    !gitHubAuthStatus?.connected ||
                                    gitRemotes.length === 0
                                  }
                                  onClick={() => handlePushGitTag(tag.name)}
                                  type="button"
                                >
                                  {pushingGitTagName === tag.name ? t("git.pushing") : "Push"}
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("git.tagsEmpty")}</div>
                      )}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">{t("git.diff")}</div>
                      {selectedGitCommitDiff && selectedGitCommitDiff.entries.length > 0 ? (
                        <div className="git-diff-list">
                          {selectedGitCommitDiff.entries.map((entry) => (
                            <div className="git-diff-entry" key={`${selectedGitCommitDiff.commit.hash}-${entry.path}`}>
                              <div className="git-diff-meta">
                                <span className="search-result-title">{entry.path}</span>
                                <span className="search-result-line">{entry.status}</span>
                              </div>
                              <div className="git-diff-columns">
                                <div className="git-diff-column">
                                  <div className="links-panel-subheading">{t("git.diffBefore")}</div>
                                  <pre className="git-diff-code">{entry.before}</pre>
                                </div>
                                <div className="git-diff-column">
                                  <div className="links-panel-subheading">{t("git.diffAfter")}</div>
                                  <pre className="git-diff-code">{entry.after}</pre>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : selectedGitCommitHash ? (
                        <div className="empty-note">{t("git.noCommitDiff")}</div>
                      ) : (
                        <div className="empty-note">{t("git.selectCommitForDiff")}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="search-block">
                      <div className="empty-note">{t("git.notInitialized")}</div>
                      <button className="primary-button" onClick={handleInitializeGitRepository} type="button">
                        {t("git.initialize")}
                      </button>
                    </div>
                    {gitHubAuthStatus?.connected ? (
                      <div className="search-block">
                        <div className="links-panel-subheading">{t("git.clone")}</div>
                        <div className="empty-note">
                          {t("git.cloneHint")}
                        </div>
                        <form
                          className="git-branch-form"
                          onSubmit={(e) => { e.preventDefault(); handleCloneGitHubRepository(); }}
                        >
                          <input
                            aria-label={t("git.repositoryUrlToClone")}
                            className="text-input"
                            onChange={(e) => setGitCloneUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            value={gitCloneUrl}
                          />
                          <button
                            className="primary-button"
                            disabled={isCloningGitHub || !gitCloneUrl.trim()}
                            type="submit"
                          >
                            {isCloningGitHub ? t("git.repositoryCloning") : t("git.repositoryClone")}
                          </button>
                        </form>
                        {gitErrorMessage ? (
                          <div className="error-note">{gitErrorMessage}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : activeSidebarView === "tools" ? (
              <ToolsSidebar workspacePath={workspaceState?.activeWorkspace?.path ?? null} />
            ) : (
              <SettingsSidebar
                appInfo={appInfo}
                autoSyncSettings={autoSyncSettings}
                featureToggles={featureToggles}
                onAutoSyncSave={handleSaveAutoSyncSettings}
                onCreateFrontmatterTemplate={handleCreateFrontmatterTemplate}
                onFeatureTogglesSave={handleSaveFeatureToggles}
                onSave={handleSaveSettings}
                settings={editorSettings}
              />
            )}
            <div
              className="sidebar-resize-handle"
              onMouseDown={(e) => {
                sidebarResizingRef.current = true;
                sidebarResizeStartXRef.current = e.clientX;
                sidebarResizeStartWidthRef.current = sidebarWidth;
                e.preventDefault();
              }}
            />
          </aside>
        ) : null}

        {/* メインエリア */}
        <main className="main-area">
          <div className="main-area-top-bar">
            {activeTabInFocusedPane ? (
              <>
                <RenameBar
                  name={activeTabInFocusedPane.name}
                  onRename={handleRenameActiveFile}
                />
                <MoveBar onMove={handleMoveActiveFile} />
              </>
            ) : null}
            <div className="main-area-top-actions">
              <button
                className={`toolbar-btn${isSplit ? " active" : ""}`}
                onClick={toggleSplit}
                title={t("pane.split")}
                type="button"
              >
                ⊟
              </button>
              {featureToggles.rightPanel && (
                <>
                  <button
                    className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
                    onClick={() => {
                      setRightPanelView("outline");
                      if (!isRightPanelOpen) toggleRightPanel();
                      else if (rightPanelView === "outline") toggleRightPanel();
                    }}
                    title={t("pane.toggleOutline")}
                    type="button"
                  >
                    Outline
                  </button>
                  <button
                    className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
                    onClick={() => {
                      setRightPanelView("links");
                      if (!isRightPanelOpen) toggleRightPanel();
                      else if (rightPanelView === "links") toggleRightPanel();
                    }}
                    title={t("pane.toggleLinks")}
                    type="button"
                  >
                    Links
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="editor-layout">
            <div className={`panes-container${isSplit ? " panes-container--split" : ""}`}>
              <PaneView
                allFilePaths={existingMarkdownPaths}
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                frontmatterCandidates={frontmatterCandidates}
                onCreateNote={handleCreateNoteFromPane}
                onFocus={() => setFocusedPane("left")}
                onOpenWikiLink={handleOpenWikiLink}
                onScrollTargetHandled={() => setLeftPaneScrollHeading(undefined)}
                onTabClose={(tabId) => closeTab("left", tabId)}
                onTabSelect={(tabId) => setTabActive("left", tabId)}
                onTagSearch={handleTagSearch}
                onCloseOtherTabs={(tabId) => closeOtherTabs("left", tabId)}
                onCloseTabsToRight={(tabId) => closeTabsToRight("left", tabId)}
                onCloseAllTabs={() => closeAllTabsInPane("left")}
                onOpenInOtherPane={(tabId) => openFileInOtherPane("left", tabId)}
                isSplitView={isSplit}
                pane="left"
                scrollTargetHeading={leftPaneScrollHeading}
                showFrontmatter={featureToggles.frontmatter}
                typewriterMode={isTypewriterMode && featureToggles.focusModes}
                workspacePath={workspaceState?.activeWorkspace?.path}
                workspaceTags={workspaceTags.map((t) => t.tag)}
              />
              {isSplit ? (
                <PaneView
                  allFilePaths={existingMarkdownPaths}
                  editorSettings={editorSettings}
                  focusedPane={focusedPane}
                  frontmatterCandidates={frontmatterCandidates}
                  onCreateNote={handleCreateNoteFromPane}
                  onFocus={() => setFocusedPane("right")}
                  onOpenWikiLink={handleOpenWikiLink}
                  onScrollTargetHandled={() => setRightPaneScrollHeading(undefined)}
                  onTabClose={(tabId) => closeTab("right", tabId)}
                  onTabSelect={(tabId) => setTabActive("right", tabId)}
                  onTagSearch={handleTagSearch}
                  onCloseOtherTabs={(tabId) => closeOtherTabs("right", tabId)}
                  onCloseTabsToRight={(tabId) => closeTabsToRight("right", tabId)}
                  onCloseAllTabs={() => closeAllTabsInPane("right")}
                  onOpenInOtherPane={(tabId) => openFileInOtherPane("right", tabId)}
                  isSplitView={isSplit}
                  pane="right"
                  scrollTargetHeading={rightPaneScrollHeading}
                  showFrontmatter={featureToggles.frontmatter}
                  typewriterMode={isTypewriterMode && featureToggles.focusModes}
                  workspacePath={workspaceState?.activeWorkspace?.path}
                  workspaceTags={workspaceTags.map((t) => t.tag)}
                />
              ) : null}
            </div>

            {isRightPanelOpen ? (
              <aside className="right-panel">
                <div className="pane-heading">
                  {rightPanelView === "outline" ? "Outline" : "Links"}
                </div>
                {rightPanelView === "outline" ? (
                  outlineHeadings.length > 0 ? (
                    <ul className="outline-list">
                      {outlineHeadings.map((h, i) => (
                        <li
                          className={`outline-item outline-item--h${h!.level}`}
                          key={i}
                          onClick={() => {
                            const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;
                            setScrollHeading(h!.text);
                          }}
                          title={h!.text}
                        >
                          {h!.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-note">{t("empty.noHeadings")}</div>
                  )
                ) : outgoingLinks.length > 0 || backlinks.length > 0 || isLoadingBacklinks ? (
                  <div className="links-panel-stack">
                    <div className="links-panel-section">
                      <div className="links-panel-subheading">{t("links.outgoing")}</div>
                      {outgoingLinks.length > 0 ? (
                        <ul className="links-list">
                          {outgoingLinks.map((link, i) => (
                            <li className="links-list-item" key={`${link.wikiLink.raw}-${i}`}>
                              <span className={`links-list-kind links-list-kind--${link.wikiLink.kind}`}>
                                {link.wikiLink.kind === "embed" ? t("links.embed") : t("links.link")}
                              </span>
                              <button
                                className={`links-list-target${link.exists ? "" : " links-list-target--missing"}`}
                                onClick={() => handleOpenWikiLink(link.wikiLink.target)}
                                title={link.exists ? link.path : t("links.createAndOpen", { path: link.path })}
                                type="button"
                              >
                                {link.displayName}
                              </button>
                              {!link.exists ? (
                                <span className="links-list-detail">{t("links.missing")}</span>
                              ) : null}
                              {link.wikiLink.heading ? (
                                <span className="links-list-detail">#{link.wikiLink.heading}</span>
                              ) : null}
                              {link.wikiLink.blockId ? (
                                <span className="links-list-detail">^{link.wikiLink.blockId}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("empty.noLinks")}</div>
                      )}
                    </div>
                    <div className="links-panel-section">
                      <div className="links-panel-subheading">{t("links.backlinks")}</div>
                      {isLoadingBacklinks ? (
                        <div className="empty-note">{t("common.loading")}</div>
                      ) : backlinks.length > 0 ? (
                        <ul className="links-list">
                          {backlinks.map((backlink) => (
                            <li className="links-list-item" key={backlink.sourcePath}>
                              <span className="links-list-kind links-list-kind--backlink">
                                Back
                              </span>
                              <button
                                className="links-list-target"
                                onClick={() => handleOpenFile(backlink.sourcePath)}
                                title={backlink.sourcePath}
                                type="button"
                              >
                                {backlink.sourceName}
                              </button>
                              {backlink.count > 1 ? (
                                <span className="links-list-detail">{backlink.count}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("empty.noBacklinks")}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-note">{t("empty.noLinks")}</div>
                )}
              </aside>
            ) : null}
          </div>
        </main>
      </div>

      <footer className="status-bar">
        <span>Relic</span>
        {activeTabInFocusedPane ? (
          <span>
            {t("app.wordCount", {
              chars: activeTabInFocusedPane.content.length,
              words: activeTabInFocusedPane.content.split(/\s+/).filter(Boolean).length
            })}
          </span>
        ) : (
          <span>{t("app.wordCount", { chars: 0, words: 0 })}</span>
        )}
        {featureToggles.git && gitStatus?.initialized && gitStatus.currentBranch ? (
          <span className="status-bar-branch">⎇ {gitStatus.currentBranch}</span>
        ) : null}
      </footer>

      {showCommandPalette ? (
        <CommandPalette commands={commands} onClose={() => setShowCommandPalette(false)} />
      ) : null}

      {showQuickSwitcher ? (
        <QuickSwitcher
          filePaths={existingMarkdownPaths}
          onClose={() => setShowQuickSwitcher(false)}
          onSelect={handleOpenFile}
        />
      ) : null}

      {toastMessage ? (
        <div className={`toast toast--${toastMessage.type}`} onClick={() => setToastMessage(null)}>
          {toastMessage.text}
        </div>
      ) : null}
    </div>
    </I18nProvider>
  );
}

// ────────────────────────────────────────────────
// RenameBar（ファイル名インライン変更）
// ────────────────────────────────────────────────

function RenameBar({ name, onRename }: { name: string; onRename: (v: string) => void }): ReactElement {
  const t = useT();
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(name);
    setEditing(false);
  }, [name]);

  if (!editing) {
    return (
      <button
        className="rename-bar-label"
        onClick={() => setEditing(true)}
        title={t("pane.rename")}
        type="button"
      >
        {name}
      </button>
    );
  }

  return (
    <form
      className="rename-bar-form"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(draft);
        setEditing(false);
      }}
    >
      <input
        autoFocus
        className="rename-bar-input"
        onBlur={() => {
          onRename(draft);
          setEditing(false);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        value={draft}
      />
    </form>
  );
}

function MoveBar({ onMove }: { onMove: (dest: string) => void }): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        className="toolbar-btn"
        onClick={() => setOpen(true)}
        title={t("pane.moveToFolder")}
        type="button"
      >
        Move
      </button>
    );
  }

  return (
    <form
      className="rename-bar-form"
      onSubmit={(e) => {
        e.preventDefault();
        onMove(draft);
        setDraft("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        className="rename-bar-input"
        onBlur={() => setOpen(false)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft("");
            setOpen(false);
          }
        }}
        placeholder={t("pane.moveDestination")}
        value={draft}
      />
    </form>
  );
}

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
