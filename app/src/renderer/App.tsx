import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  Backlink,
  GitCommitDiff,
  EditorSettings,
  GitCommitSummary,
  GitStatus,
  GitWorkingChange,
  MarkdownFileContent,
  SearchAndReplaceMatch,
  SearchMode,
  WorkspaceState,
  WorkspaceSearchResult,
  WorkspaceTagSummary,
  WorkspaceTreeNode
} from "../shared/ipc";
import { resolveWikiLinkPath, resolveWikiLinks } from "../shared/links";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { Editor } from "./components/Editor";
import { FrontmatterForm } from "./components/FrontmatterForm";
import { Preview } from "./components/Preview";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { Toolbar } from "./components/Toolbar";
import { useAutoSave } from "./hooks/useAutoSave";
import { useEditorStore, type PaneId } from "./store/editorStore";
import { useUiStore, type SidebarView } from "./store/uiStore";
import "./styles.css";

// ────────────────────────────────────────────────
// FileTree
// ────────────────────────────────────────────────

function FileTree({
  activePaths,
  nodes,
  onOpenFile,
  onSelectFolder
}: {
  activePaths: Set<string>;
  nodes: WorkspaceTreeNode[];
  onOpenFile: (path: string) => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
}): ReactElement {
  if (nodes.length === 0) {
    return <div className="empty-note">Markdownファイルはまだありません。</div>;
  }

  return (
    <ul className="file-tree">
      {nodes.map((node) => (
        <li className="file-tree-item" key={node.path}>
          <button
            className={`file-tree-row ${node.type}${activePaths.has(node.path) ? " active" : ""}`}
            onClick={() => {
              if (node.type === "file") {
                onOpenFile(node.path);
              } else {
                onSelectFolder(node);
              }
            }}
            type="button"
          >
            <span className="file-tree-icon">{node.type === "folder" ? "▶" : "·"}</span>
            <span className="file-tree-name">{node.name}</span>
          </button>
          {node.type === "folder" && node.children.length > 0 ? (
            <FileTree
              activePaths={activePaths}
              nodes={node.children}
              onOpenFile={onOpenFile}
              onSelectFolder={onSelectFolder}
            />
          ) : null}
        </li>
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
  isOpeningWorkspace: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onFileNameDraftChange: (v: string) => void;
  onFolderNameDraftChange: (v: string) => void;
  onOpenFile: (path: string) => void;
  onOpenWorkspace: () => void;
  onSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  onSwitchWorkspace: (id: string) => void;
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
          setReplaceStatus(`${result.value.count} 件置換しました。`);
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
        aria-label="検索"
        className={`search-input${error ? " search-input--error" : ""}`}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={mode === "frontmatter" ? "値を入力" : "検索"}
        value={query}
        list={mode === "frontmatter" && frontmatterValueCandidates.length > 0 ? "search-frontmatter-values" : undefined}
      />
      <select
        aria-label="検索モード"
        className="search-mode-select"
        onChange={(event) => onModeChange(event.target.value as SearchMode)}
        value={mode}
      >
        <option value="fullText">全文</option>
        <option value="fileName">ファイル名</option>
        <option value="tag">タグ</option>
        <option value="regex">正規表現</option>
        <option value="frontmatter">フロントマター</option>
      </select>
      {mode === "frontmatter" ? (
        <div className="search-frontmatter-fields">
          <input
            aria-label="フロントマターフィールド"
            className="search-input"
            list="search-frontmatter-fields"
            onChange={(event) => onFrontmatterFieldChange(event.target.value)}
            placeholder="field名"
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
            ["行頭が見出し", "^#+ "],
            ["URLを含む行", "https?://"],
            ["日付形式", "\\d{4}-\\d{2}-\\d{2}"],
            ["タグ記法", "#\\w+"]
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
        <div className="links-panel-subheading">Results</div>
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
          <div className="empty-note">フィールド名を入力してください。</div>
        ) : query.trim() ? (
          <div className="empty-note">一致する結果はありません。</div>
        ) : (
          <div className="empty-note">検索語句を入力してください。</div>
        )}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">置換</div>
        <input
          aria-label="置換する語句"
          className={`search-input${replaceError && replaceError.includes("正規表現") ? " search-input--error" : ""}`}
          onChange={(e) => { setReplaceQuery(e.target.value); setReplacePreview(null); setReplaceStatus(null); }}
          placeholder="検索語句"
          value={replaceQuery}
        />
        <input
          aria-label="置換後テキスト"
          className="search-input"
          onChange={(e) => { setReplacementText(e.target.value); setReplacePreview(null); setReplaceStatus(null); }}
          placeholder="置換後テキスト"
          value={replacementText}
        />
        <label className="setting-row replace-regex-row">
          <input
            checked={replaceIsRegex}
            onChange={(e) => setReplaceIsRegex(e.target.checked)}
            type="checkbox"
          />
          <span>正規表現</span>
        </label>
        <div className="replace-actions">
          {activeFilePath ? (
            <button
              className="replace-btn"
              disabled={isReplacing || replaceQuery.trim() === ""}
              onClick={handleReplaceInFile}
              title="現在のファイルのみ置換"
              type="button"
            >
              このファイルを置換
            </button>
          ) : null}
          <button
            className="replace-btn"
            disabled={isReplacing || replaceQuery.trim() === ""}
            onClick={handlePreviewBulkReplace}
            type="button"
          >
            一括プレビュー
          </button>
        </div>
        {replaceError ? <div className="error-note">{replaceError}</div> : null}
        {replaceStatus ? <div className="replace-status">{replaceStatus}</div> : null}
        {replacePreview !== null ? (
          <div className="replace-preview">
            <div className="replace-preview-header">
              {replacePreview.length} 件が一致 — 置換後:
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
                    <span className="search-result-line">…他 {replacePreview.length - 50} 件</span>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className="empty-note">一致する箇所はありません。</div>
            )}
            {replacePreview.length > 0 ? (
              <button
                className="replace-btn replace-btn--confirm"
                disabled={isReplacing}
                onClick={handleApplyBulkReplace}
                type="button"
              >
                一括置換を実行
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="search-block">
        <div className="links-panel-subheading">Tags</div>
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
          <div className="empty-note">タグはまだありません。</div>
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
  isOpeningWorkspace,
  onCreateFile,
  onCreateFolder,
  onFileNameDraftChange,
  onFolderNameDraftChange,
  onOpenFile,
  onOpenWorkspace,
  onSelectFolder,
  onSwitchWorkspace,
  workspaceState
}: FilesSidebarProps): ReactElement {
  const activeWorkspace = workspaceState?.activeWorkspace ?? null;

  return (
    <div className="sidebar-section">
      <div className="workspace-card">
        <div className="workspace-name" title={activeWorkspace?.path}>
          {activeWorkspace ? activeWorkspace.name : "ワークスペース未選択"}
        </div>
      </div>
      <button
        className="primary-button"
        disabled={isOpeningWorkspace}
        onClick={onOpenWorkspace}
        type="button"
      >
        {isOpeningWorkspace ? "開いています…" : "フォルダを開く"}
      </button>
      {workspaceState && workspaceState.workspaces.length > 1 ? (
        <div className="workspace-list" aria-label="登録済みワークスペース">
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
              aria-label="新規ノート名"
              className="text-input"
              onChange={(e) => onFileNameDraftChange(e.target.value)}
              placeholder="新規ノート名"
              value={fileNameDraft}
            />
            <button disabled={isCreatingFile} type="submit">
              作成
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
              aria-label="新規フォルダ名"
              className="text-input"
              onChange={(e) => onFolderNameDraftChange(e.target.value)}
              placeholder="新規フォルダ名"
              value={folderNameDraft}
            />
            <button disabled={isCreatingFolder} type="submit">
              フォルダ作成
            </button>
          </form>
          <FileTree
            activePaths={activePaths}
            nodes={workspaceState?.fileTree ?? []}
            onOpenFile={onOpenFile}
            onSelectFolder={onSelectFolder}
          />
        </>
      ) : (
        <div className="empty-note">任意のローカルフォルダをワークスペースとして開けます。</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// SettingsSidebar
// ────────────────────────────────────────────────

function SettingsSidebar({
  settings,
  onCreateFrontmatterTemplate,
  onSave
}: {
  settings: EditorSettings;
  onCreateFrontmatterTemplate: () => void;
  onSave: (s: EditorSettings) => void;
}): ReactElement {
  const [draft, setDraft] = useState<EditorSettings>(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSave(next);
  };

  return (
    <div className="sidebar-section settings-section">
      <label className="setting-row">
        <span>フォント</span>
        <select
          aria-label="フォント"
          onChange={(e) => update("font", e.target.value as EditorSettings["font"])}
          value={draft.font}
        >
          <option value="system">システムフォント</option>
          <option value="mincho">ヒラギノ明朝</option>
          <option value="mono">Menlo</option>
        </select>
      </label>
      <label className="setting-row">
        <span>フォントサイズ</span>
        <input
          max={32}
          min={10}
          onChange={(e) => update("fontSize", Number(e.target.value))}
          type="number"
          value={draft.fontSize}
        />
      </label>
      <label className="setting-row">
        <span>行間</span>
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
        <span>最大幅</span>
        <select
          aria-label="最大幅"
          onChange={(e) => update("maxWidth", e.target.value as EditorSettings["maxWidth"])}
          value={draft.maxWidth}
        >
          <option value="550px">狭め（550px）</option>
          <option value="660px">標準（660px）</option>
          <option value="800px">広め（800px）</option>
          <option value="none">制限なし</option>
        </select>
      </label>
      <label className="setting-row">
        <input
          checked={draft.showLineNumbers}
          onChange={(e) => update("showLineNumbers", e.target.checked)}
          type="checkbox"
        />
        <span>行番号を表示</span>
      </label>
      <label className="setting-row">
        <input
          checked={draft.spellCheck}
          onChange={(e) => update("spellCheck", e.target.checked)}
          type="checkbox"
        />
        <span>スペルチェック</span>
      </label>
      <div className="setting-row setting-row--action">
        <span>フロントマター候補定義</span>
        <button className="setting-action-btn" onClick={onCreateFrontmatterTemplate} type="button">
          frontmatter.md を作成
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// PaneView — タブバー + エディタ
// ────────────────────────────────────────────────

interface PaneViewProps {
  allFilePaths: string[];
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  pane: PaneId;
  scrollTargetHeading?: string;
  typewriterMode: boolean;
  workspacePath?: string | null;
  workspaceTags: string[];
  onFocus: () => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
}

function PaneView({
  allFilePaths,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  pane,
  scrollTargetHeading,
  typewriterMode,
  workspacePath,
  workspaceTags,
  onFocus,
  onOpenWikiLink,
  onTabClose,
  onTabSelect
}: PaneViewProps): ReactElement {
  const { leftPane, rightPane, tabs, updateTabContent, setTabViewMode } = useEditorStore();
  const paneState = pane === "left" ? leftPane : rightPane;
  const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  const viewRef = useRef<EditorView | null>(null);

  // 自動保存
  useAutoSave(activeTab?.content ?? "", activeTab?.path ?? null, activeTab !== null);

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
            >
              <span className="pane-tab-name">{tab.name}</span>
              <button
                className="pane-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tabId);
                }}
                title="タブを閉じる"
                type="button"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* エディタ本体 or 空状態 */}
      {activeTab ? (
        <div className="editor-surface">
          <div className="editor-mode-bar">
            {activeTab.viewMode === "source" ? (
              <Toolbar viewRef={viewRef} />
            ) : (
              <div className="toolbar" />
            )}
            <div className="editor-mode-toggle">
              <button
                className={`mode-btn${activeTab.viewMode === "preview" ? " mode-btn--active" : ""}`}
                onClick={() => setTabViewMode(activeTab.id, "preview")}
                type="button"
              >
                プレビュー
              </button>
              <button
                className={`mode-btn${activeTab.viewMode === "source" ? " mode-btn--active" : ""}`}
                onClick={() => setTabViewMode(activeTab.id, "source")}
                type="button"
              >
                ソース
              </button>
            </div>
          </div>
          <div className="editor-body">
            {activeTab.viewMode === "source" ? (
              <Editor
                allFilePaths={allFilePaths}
                content={activeTab.content}
                key={activeTab.id}
                onChange={(content) => updateTabContent(activeTab.id, content)}
                settings={editorSettings}
                typewriterMode={typewriterMode}
                viewRef={viewRef}
              />
            ) : (
              <div className="preview-with-fm">
                <FrontmatterForm
                  candidates={frontmatterCandidates}
                  content={activeTab.content}
                  key={`fm-${activeTab.id}`}
                  onChange={(content) => updateTabContent(activeTab.id, content)}
                  workspaceTags={workspaceTags}
                />
                <Preview
                  content={activeTab.content}
                  key={`preview-${activeTab.id}`}
                  onChange={(content) => updateTabContent(activeTab.id, content)}
                  onOpenWikiLink={onOpenWikiLink}
                  scrollTargetHeading={scrollTargetHeading}
                  settings={editorSettings}
                  workspacePath={workspacePath}
                />
              </div>
            )}
          </div>
          <div className="pane-status">
            <span>{charCount} 文字</span>
            <span>{wordCount} 語</span>
          </div>
        </div>
      ) : (
        <div className="empty-pane">
          <p>ファイルツリーからノートを開いてください</p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────

const sidebarViews: Array<{ id: SidebarView; label: string; icon: string }> = [
  { id: "files", label: "ファイル", icon: "F" },
  { id: "search", label: "検索", icon: "S" },
  { id: "git", label: "Git", icon: "G" },
  { id: "settings", label: "設定", icon: "⚙" }
];

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
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
  const [gitCommitHistory, setGitCommitHistory] = useState<GitCommitSummary[]>([]);
  const [gitWorkingChanges, setGitWorkingChanges] = useState<GitWorkingChange[]>([]);
  const [selectedGitCommitHash, setSelectedGitCommitHash] = useState<string | null>(null);
  const [selectedGitCommitDiff, setSelectedGitCommitDiff] = useState<GitCommitDiff | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = useState("");
  const [gitAuthorName, setGitAuthorName] = useState("");
  const [gitAuthorEmail, setGitAuthorEmail] = useState("");
  const [isCreatingGitCommit, setIsCreatingGitCommit] = useState(false);
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

  // 初期ロード
  useEffect(() => {
    void window.relic?.getWorkspaceState().then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic?.getEditorSettings().then((result) => {
      if (result.ok) {
        setEditorSettings(result.value);
      }
    });
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
      setGitCommitHistory([]);
      setGitWorkingChanges([]);
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
      setGitCommitHistory([]);
      setGitWorkingChanges([]);
      setSelectedGitCommitHash(null);
      setSelectedGitCommitDiff(null);
      return;
    }

    let canceled = false;

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
  }, [gitStatus?.initialized, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

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

  const handleInitializeGitRepository = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.initializeGitRepository().then((result) => {
      if (result.ok) {
        setGitStatus(result.value);
        setWorkspaceError(null);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

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
        void window.relic!.getGitWorkingChanges().then((changesResult) => {
          if (changesResult.ok) {
            setGitWorkingChanges(changesResult.value);
          }
        });
      })
      .finally(() => setIsCreatingGitCommit(false));
  }, [gitAuthorEmail, gitAuthorName, gitCommitMessage]);

  // ──────────────────
  // ファイル移動
  // ──────────────────

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

  // ──────────────────
  // キーボードショートカット
  // ──────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.metaKey) return;

      if (e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "\\" ) {
        e.preventDefault();
        toggleSplit();
      } else if (e.key === "b" && e.shiftKey) {
        e.preventDefault();
        toggleRightPanel();
      } else if (e.key === "w") {
        e.preventDefault();
        const paneState = focusedPane === "left" ? leftPane : rightPane;

        if (paneState.activeTabId) {
          closeTab(focusedPane, paneState.activeTabId);
        }
      } else if (e.key === "f" && e.shiftKey) {
        e.preventDefault();
        toggleFocusMode();
      } else if (e.key === "t" && e.shiftKey) {
        e.preventDefault();
        toggleTypewriterMode();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [focusedPane, leftPane, rightPane, closeTab, toggleSidebar, toggleSplit, toggleRightPanel, toggleFocusMode, toggleTypewriterMode]);

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
      label: "新規ノートを作成",
      action: () => { setSidebarView("files"); if (!isSidebarOpen) toggleSidebar(); setIsCreatingFile(true); }
    },
    {
      id: "search",
      label: "検索を開く",
      action: () => { setSidebarView("search"); if (!isSidebarOpen) toggleSidebar(); }
    },
    {
      id: "quick-switcher",
      label: "クイックスイッチャーを開く",
      shortcut: "⌘P",
      action: () => setShowQuickSwitcher(true)
    },
    {
      id: "toggle-sidebar",
      label: "サイドバーを開閉",
      shortcut: "⌘B",
      action: toggleSidebar
    },
    {
      id: "toggle-split",
      label: "分割表示を切り替え",
      shortcut: "⌘\\",
      action: toggleSplit
    },
    {
      id: "toggle-right-panel",
      label: "右パネルを切り替え",
      shortcut: "⌘⇧B",
      action: toggleRightPanel
    },
    {
      id: "toggle-focus",
      label: "フォーカスモードを切り替え",
      shortcut: "⌘⇧F",
      action: toggleFocusMode
    },
    {
      id: "toggle-typewriter",
      label: "タイプライターモードを切り替え",
      shortcut: "⌘⇧T",
      action: toggleTypewriterMode
    },
    {
      id: "git",
      label: "Git ビューを開く",
      action: () => { setSidebarView("git"); if (!isSidebarOpen) toggleSidebar(); }
    },
    {
      id: "settings",
      label: "設定を開く",
      action: () => { setSidebarView("settings"); if (!isSidebarOpen) toggleSidebar(); }
    }
  ];

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <div className={`app-shell${isFocusMode ? " app-shell--focus" : ""}`}>
      <div className="workspace">
        {/* 縦アイコンナビ（レール） */}
        <nav aria-label="ビュー切り替え" className="rail">
          <button
            aria-label="サイドバーを開閉"
            className="rail-button"
            onClick={toggleSidebar}
            title="サイドバーを開閉 (⌘B)"
            type="button"
          >
            {isSidebarOpen ? "◁" : "▷"}
          </button>
          <div className="rail-separator" />
          {sidebarViews.map((view) => (
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
          <aside className="sidebar">
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
                isOpeningWorkspace={isOpeningWorkspace}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onFileNameDraftChange={setFileNameDraft}
                onFolderNameDraftChange={setFolderNameDraft}
                onOpenFile={handleOpenFile}
                onOpenWorkspace={handleOpenWorkspace}
                onSelectFolder={handleSelectFolder}
                onSwitchWorkspace={handleSwitchWorkspace}
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
                  <div className="empty-note">ワークスペースを開くとGit状態を表示できます。</div>
                ) : gitStatus?.initialized ? (
                  <>
                    <div className="search-block">
                      <div className="links-panel-subheading">Repository</div>
                      <div className="setting-row">
                        <span>状態</span>
                        <span>初期化済み</span>
                      </div>
                      <div className="setting-row">
                        <span>ブランチ</span>
                        <span>{gitStatus.currentBranch ?? "(detached)"}</span>
                      </div>
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">Commit</div>
                      <input
                        aria-label="Git作者名"
                        className="text-input"
                        onChange={(event) => setGitAuthorName(event.target.value)}
                        placeholder="作者名"
                        value={gitAuthorName}
                      />
                      <input
                        aria-label="Git作者メール"
                        className="text-input"
                        onChange={(event) => setGitAuthorEmail(event.target.value)}
                        placeholder="author@example.com"
                        value={gitAuthorEmail}
                      />
                      <input
                        aria-label="Gitコミットメッセージ"
                        className="text-input"
                        onChange={(event) => setGitCommitMessage(event.target.value)}
                        placeholder="コミットメッセージ"
                        value={gitCommitMessage}
                      />
                      <button
                        className="primary-button"
                        disabled={isCreatingGitCommit}
                        onClick={handleCreateGitCommit}
                        type="button"
                      >
                        {isCreatingGitCommit ? "コミット中..." : "ローカルコミットを作成"}
                      </button>
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">Changes</div>
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
                        <div className="empty-note">未コミットの変更はありません。</div>
                      )}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">History</div>
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
                        <div className="empty-note">コミット履歴はまだありません。</div>
                      )}
                    </div>
                    <div className="search-block">
                      <div className="links-panel-subheading">Diff</div>
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
                                  <div className="links-panel-subheading">Before</div>
                                  <pre className="git-diff-code">{entry.before}</pre>
                                </div>
                                <div className="git-diff-column">
                                  <div className="links-panel-subheading">After</div>
                                  <pre className="git-diff-code">{entry.after}</pre>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : selectedGitCommitHash ? (
                        <div className="empty-note">このコミットの差分はありません。</div>
                      ) : (
                        <div className="empty-note">コミットを選ぶと差分を表示します。</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="search-block">
                    <div className="empty-note">このワークスペースはまだGit管理されていません。</div>
                    <button className="primary-button" onClick={handleInitializeGitRepository} type="button">
                      このワークスペースでGitを初期化
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <SettingsSidebar
                onCreateFrontmatterTemplate={handleCreateFrontmatterTemplate}
                onSave={handleSaveSettings}
                settings={editorSettings}
              />
            )}
            {workspaceError ? <div className="error-note">{workspaceError}</div> : null}
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
                title="分割表示 (⌘\\)"
                type="button"
              >
                ⊟
              </button>
              <button
                className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
                onClick={() => {
                  setRightPanelView("outline");

                  if (!isRightPanelOpen) toggleRightPanel();
                  else if (rightPanelView === "outline") toggleRightPanel();
                }}
                title="アウトライン (⌘⇧B)"
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
                title="リンク"
                type="button"
              >
                Links
              </button>
            </div>
          </div>

          <div className="editor-layout">
            <div className={`panes-container${isSplit ? " panes-container--split" : ""}`}>
              <PaneView
                allFilePaths={existingMarkdownPaths}
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                frontmatterCandidates={frontmatterCandidates}
                onFocus={() => setFocusedPane("left")}
                onOpenWikiLink={handleOpenWikiLink}
                onTabClose={(tabId) => closeTab("left", tabId)}
                onTabSelect={(tabId) => setTabActive("left", tabId)}
                pane="left"
                scrollTargetHeading={leftPaneScrollHeading}
                typewriterMode={isTypewriterMode}
                workspacePath={workspaceState?.activeWorkspace?.path}
                workspaceTags={workspaceTags.map((t) => t.tag)}
              />
              {isSplit ? (
                <PaneView
                  allFilePaths={existingMarkdownPaths}
                  editorSettings={editorSettings}
                  focusedPane={focusedPane}
                  frontmatterCandidates={frontmatterCandidates}
                  onFocus={() => setFocusedPane("right")}
                  onOpenWikiLink={handleOpenWikiLink}
                  onTabClose={(tabId) => closeTab("right", tabId)}
                  onTabSelect={(tabId) => setTabActive("right", tabId)}
                  pane="right"
                  scrollTargetHeading={rightPaneScrollHeading}
                  typewriterMode={isTypewriterMode}
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
                          title={h!.text}
                        >
                          {h!.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-note">見出しがありません。</div>
                  )
                ) : outgoingLinks.length > 0 || backlinks.length > 0 || isLoadingBacklinks ? (
                  <div className="links-panel-stack">
                    <div className="links-panel-section">
                      <div className="links-panel-subheading">Outgoing</div>
                      {outgoingLinks.length > 0 ? (
                        <ul className="links-list">
                          {outgoingLinks.map((link, i) => (
                            <li className="links-list-item" key={`${link.wikiLink.raw}-${i}`}>
                              <span className={`links-list-kind links-list-kind--${link.wikiLink.kind}`}>
                                {link.wikiLink.kind === "embed" ? "Embed" : "Link"}
                              </span>
                              <button
                                className={`links-list-target${link.exists ? "" : " links-list-target--missing"}`}
                                onClick={() => handleOpenWikiLink(link.wikiLink.target)}
                                title={link.exists ? link.path : `${link.path} を作成して開く`}
                                type="button"
                              >
                                {link.displayName}
                              </button>
                              {!link.exists ? (
                                <span className="links-list-detail">未作成</span>
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
                        <div className="empty-note">このノートから出ているリンクはありません。</div>
                      )}
                    </div>
                    <div className="links-panel-section">
                      <div className="links-panel-subheading">Backlinks</div>
                      {isLoadingBacklinks ? (
                        <div className="empty-note">読み込んでいます…</div>
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
                                <span className="links-list-detail">{backlink.count} 件</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">このノートへのバックリンクはありません。</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-note">このノートから出ているリンクはありません。</div>
                )}
              </aside>
            ) : null}
          </div>
        </main>
      </div>

      <footer className="status-bar">
        <span>Relic</span>
        {activeTabInFocusedPane ? (
          <>
            <span>{activeTabInFocusedPane.content.length} 文字</span>
            <span>
              {activeTabInFocusedPane.content.split(/\s+/).filter(Boolean).length} 語
            </span>
          </>
        ) : (
          <span>0 文字 / 0 語</span>
        )}
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
    </div>
  );
}

// ────────────────────────────────────────────────
// RenameBar（ファイル名インライン変更）
// ────────────────────────────────────────────────

function RenameBar({ name, onRename }: { name: string; onRename: (v: string) => void }): ReactElement {
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
        title="クリックして名前を変更"
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        className="toolbar-btn"
        onClick={() => setOpen(true)}
        title="フォルダへ移動"
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
        placeholder="移動先フォルダ（空=ルート）"
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
