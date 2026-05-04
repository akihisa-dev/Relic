import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  EditorSettings,
  MarkdownFileContent,
  WorkspaceState,
  WorkspaceTreeNode
} from "../shared/ipc";
import { Editor } from "./components/Editor";
import { Preview } from "./components/Preview";
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
  onSave
}: {
  settings: EditorSettings;
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
    </div>
  );
}

// ────────────────────────────────────────────────
// PaneView — タブバー + エディタ
// ────────────────────────────────────────────────

interface PaneViewProps {
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  pane: PaneId;
  typewriterMode: boolean;
  onFocus: () => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
}

function PaneView({
  editorSettings,
  focusedPane,
  pane,
  typewriterMode,
  onFocus,
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
                content={activeTab.content}
                key={activeTab.id}
                onChange={(content) => updateTabContent(activeTab.id, content)}
                settings={editorSettings}
                typewriterMode={typewriterMode}
                viewRef={viewRef}
              />
            ) : (
              <Preview
                content={activeTab.content}
                key={`preview-${activeTab.id}`}
                onChange={(content) => updateTabContent(activeTab.id, content)}
                settings={editorSettings}
              />
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
              <div className="sidebar-section">
                <input aria-label="検索" className="search-input" placeholder="検索" />
                <div className="empty-note">検索インデックスはフェーズ4で追加します。</div>
              </div>
            ) : activeSidebarView === "git" ? (
              <div className="sidebar-section">
                <div className="empty-note">Git連携はフェーズ6で追加します。</div>
              </div>
            ) : (
              <SettingsSidebar onSave={handleSaveSettings} settings={editorSettings} />
            )}
            {workspaceError ? <div className="error-note">{workspaceError}</div> : null}
          </aside>
        ) : null}

        {/* メインエリア */}
        <main className="main-area">
          <div className="main-area-top-bar">
            {activeTabInFocusedPane ? (
              <RenameBar
                name={activeTabInFocusedPane.name}
                onRename={handleRenameActiveFile}
              />
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
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                onFocus={() => setFocusedPane("left")}
                onTabClose={(tabId) => closeTab("left", tabId)}
                onTabSelect={(tabId) => setTabActive("left", tabId)}
                pane="left"
                typewriterMode={isTypewriterMode}
              />
              {isSplit ? (
                <PaneView
                  editorSettings={editorSettings}
                  focusedPane={focusedPane}
                  onFocus={() => setFocusedPane("right")}
                  onTabClose={(tabId) => closeTab("right", tabId)}
                  onTabSelect={(tabId) => setTabActive("right", tabId)}
                  pane="right"
                  typewriterMode={isTypewriterMode}
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
                ) : (
                  <div className="empty-note">リンク一覧はフェーズ4で追加します。</div>
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
