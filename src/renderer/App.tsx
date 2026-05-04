import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import type {
  AppInfo,
  MarkdownFileContent,
  WorkspaceState,
  WorkspaceTreeNode
} from "../shared/ipc";
import { useUiStore, type SidebarView } from "./store/uiStore";
import "./styles.css";

const sidebarViews: Array<{ id: SidebarView; label: string; icon: string }> = [
  { id: "files", label: "ファイル", icon: "F" },
  { id: "search", label: "検索", icon: "S" },
  { id: "git", label: "Git", icon: "G" },
  { id: "settings", label: "設定", icon: "*" }
];

const sidebarTitles: Record<SidebarView, string> = {
  files: "Files",
  search: "Search",
  git: "Git",
  settings: "Settings"
};

function FileTree({
  activeFilePath,
  nodes,
  onOpenFile
}: {
  activeFilePath: string | null;
  nodes: WorkspaceTreeNode[];
  onOpenFile: (path: string) => void;
}): ReactElement {
  if (nodes.length === 0) {
    return <div className="empty-note">表示できるMarkdownファイルはまだありません。</div>;
  }

  return (
    <ul className="file-tree">
      {nodes.map((node) => (
        <li className="file-tree-item" key={node.path}>
          <button
            className={`file-tree-row ${node.type} ${node.path === activeFilePath ? "active" : ""}`}
            disabled={node.type === "folder"}
            onClick={() => {
              if (node.type === "file") {
                onOpenFile(node.path);
              }
            }}
            type="button"
          >
            <span className="file-tree-icon">{node.type === "folder" ? "Folder" : "Note"}</span>
            <span className="file-tree-name">{node.name}</span>
          </button>
          {node.type === "folder" && node.children.length > 0 ? (
            <FileTree activeFilePath={activeFilePath} nodes={node.children} onOpenFile={onOpenFile} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

interface SidebarContentProps {
  activeFilePath: string | null;
  fileNameDraft: string;
  folderNameDraft: string;
  isOpeningWorkspace: boolean;
  isCreatingFile: boolean;
  isCreatingFolder: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onFileNameDraftChange: (value: string) => void;
  onFolderNameDraftChange: (value: string) => void;
  onOpenFile: (path: string) => void;
  onOpenWorkspace: () => void;
  onSwitchWorkspace: (workspaceId: string) => void;
  view: SidebarView;
  workspaceState: WorkspaceState | null;
}

function SidebarContent({
  activeFilePath,
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
  onSwitchWorkspace,
  view,
  workspaceState
}: SidebarContentProps): ReactElement {
  if (view === "files") {
    const activeWorkspace = workspaceState?.activeWorkspace ?? null;

    return (
      <div className="sidebar-section">
        <div className="workspace-card">
          <div className="workspace-name">
            {activeWorkspace ? activeWorkspace.name : "ワークスペース未選択"}
          </div>
          {activeWorkspace ? <div className="workspace-path">{activeWorkspace.path}</div> : null}
        </div>
        <button
          className="primary-button"
          disabled={isOpeningWorkspace}
          onClick={onOpenWorkspace}
          type="button"
        >
          {isOpeningWorkspace ? "開いています" : "フォルダを開く"}
        </button>
        {workspaceState && workspaceState.workspaces.length > 1 ? (
          <div className="workspace-list" aria-label="登録済みワークスペース">
            {workspaceState.workspaces.map((workspace) => (
              <button
                className={`workspace-list-item ${
                  workspace.id === activeWorkspace?.id ? "active" : ""
                }`}
                key={workspace.id}
                onClick={() => onSwitchWorkspace(workspace.id)}
                title={workspace.path}
                type="button"
              >
                {workspace.name}
              </button>
            ))}
          </div>
        ) : null}
        {activeWorkspace ? (
          <>
            <form
              className="new-file-form"
              onSubmit={(event) => {
                event.preventDefault();
                onCreateFile();
              }}
            >
              <input
                aria-label="新規ノート名"
                className="text-input"
                onChange={(event) => onFileNameDraftChange(event.target.value)}
                placeholder="新規ノート名"
                value={fileNameDraft}
              />
              <button disabled={isCreatingFile} type="submit">
                ノート作成
              </button>
            </form>
            <form
              className="new-file-form"
              onSubmit={(event) => {
                event.preventDefault();
                onCreateFolder();
              }}
            >
              <input
                aria-label="新規フォルダ名"
                className="text-input"
                onChange={(event) => onFolderNameDraftChange(event.target.value)}
                placeholder="新規フォルダ名"
                value={folderNameDraft}
              />
              <button disabled={isCreatingFolder} type="submit">
                フォルダ作成
              </button>
            </form>
            <FileTree
              activeFilePath={activeFilePath}
              nodes={workspaceState?.fileTree ?? []}
              onOpenFile={onOpenFile}
            />
          </>
        ) : (
          <div className="empty-note">任意のローカルフォルダをRelicのワークスペースとして開けます。</div>
        )}
      </div>
    );
  }

  if (view === "search") {
    return (
      <div className="sidebar-section">
        <input aria-label="検索" className="search-input" placeholder="検索" />
        <div className="empty-note">検索インデックスはフェーズ4で追加します。</div>
      </div>
    );
  }

  if (view === "git") {
    return (
      <div className="sidebar-section">
        <button className="secondary-button" type="button">
          Gitを初期化
        </button>
        <div className="empty-note">ローカル履歴管理はフェーズ6で追加します。</div>
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      <label className="setting-row">
        <span>テーマ</span>
        <select aria-label="テーマ">
          <option>システム追従</option>
          <option>ライト</option>
          <option>ダーク</option>
        </select>
      </label>
      <div className="empty-note">設定保存はフェーズ1で追加します。</div>
    </div>
  );
}

export function App(): ReactElement {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<MarkdownFileContent | null>(null);
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isRenamingFile, setIsRenamingFile] = useState(false);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const {
    activeSidebarView,
    isRightPanelOpen,
    isSidebarOpen,
    rightPanelView,
    setRightPanelView,
    setSidebarView,
    toggleRightPanel,
    toggleSidebar
  } = useUiStore();

  useEffect(() => {
    void window.relic?.getAppInfo().then((result) => {
      if (result.ok) {
        setAppInfo(result.value);
      }
    });

    void window.relic?.getWorkspaceState().then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        setWorkspaceError(null);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const handleOpenWorkspace = (): void => {
    if (!window.relic) {
      setWorkspaceError("アプリAPIを利用できませんでした。");
      return;
    }

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
      .finally(() => {
        setIsOpeningWorkspace(false);
      });
  };

  const handleCreateFile = (): void => {
    if (!window.relic) {
      setWorkspaceError("アプリAPIを利用できませんでした。");
      return;
    }

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
      .finally(() => {
        setIsCreatingFile(false);
      });
  };

  const handleCreateFolder = (): void => {
    if (!window.relic) {
      setWorkspaceError("アプリAPIを利用できませんでした。");
      return;
    }

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
      .finally(() => {
        setIsCreatingFolder(false);
      });
  };

  const handleOpenFile = (path: string): void => {
    if (!window.relic) {
      setWorkspaceError("アプリAPIを利用できませんでした。");
      return;
    }

    setWorkspaceError(null);

    void window.relic.readMarkdownFile({ path }).then((result) => {
      if (result.ok) {
        setActiveFile(result.value);
        setRenameDraft(result.value.name);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  };

  const handleRenameFile = (): void => {
    if (!window.relic || !activeFile) {
      setWorkspaceError("リネームするファイルを選択してください。");
      return;
    }

    setIsRenamingFile(true);
    setWorkspaceError(null);

    void window.relic
      .renameMarkdownFile({
        newName: renameDraft,
        path: activeFile.path
      })
      .then((result) => {
        if (result.ok) {
          setActiveFile(result.value.file);
          setRenameDraft(result.value.file.name);
          setWorkspaceState(result.value.workspaceState);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => {
        setIsRenamingFile(false);
      });
  };

  const handleSwitchWorkspace = (workspaceId: string): void => {
    if (!window.relic) {
      setWorkspaceError("アプリAPIを利用できませんでした。");
      return;
    }

    setWorkspaceError(null);

    void window.relic.switchWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        setActiveFile(null);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  };

  return (
    <div className="app-shell">
      <header className="tab-bar">
        <div className="traffic-space" />
        <div className="tab active-tab">Untitled.md</div>
        <div className="tab">設計メモ.md</div>
      </header>

      <div className="workspace">
        <nav aria-label="ビュー切り替え" className="rail">
          <button
            aria-label="サイドバーを開閉"
            className="rail-button"
            onClick={toggleSidebar}
            title="サイドバーを開閉"
            type="button"
          >
            {isSidebarOpen ? "<" : ">"}
          </button>
          <div className="rail-separator" />
          {sidebarViews.map((view) => (
            <button
              aria-label={view.label}
              className={view.id === activeSidebarView ? "rail-button active" : "rail-button"}
              key={view.id}
              onClick={() => setSidebarView(view.id)}
              title={view.label}
              type="button"
            >
              {view.icon}
            </button>
          ))}
        </nav>

        {isSidebarOpen ? (
          <aside className="sidebar">
            <div className="pane-heading">{sidebarTitles[activeSidebarView]}</div>
            <SidebarContent
              activeFilePath={activeFile?.path ?? null}
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
              onSwitchWorkspace={handleSwitchWorkspace}
              view={activeSidebarView}
              workspaceState={workspaceState}
            />
            {workspaceError ? <div className="error-note">{workspaceError}</div> : null}
          </aside>
        ) : null}

        <main className="main-area">
          <div className="toolbar">
            <button type="button">B</button>
            <button type="button">I</button>
            <button type="button">Link</button>
            <div className="toolbar-spacer" />
            <button
              className={rightPanelView === "outline" ? "active-control" : ""}
              onClick={() => setRightPanelView("outline")}
              type="button"
            >
              Outline
            </button>
            <button
              className={rightPanelView === "links" ? "active-control" : ""}
              onClick={() => setRightPanelView("links")}
              type="button"
            >
              Links
            </button>
            <button onClick={toggleRightPanel} type="button">
              {isRightPanelOpen ? "Hide" : "Show"}
            </button>
          </div>

          <div className="editor-layout">
            <section aria-label="エディタ" className="editor-surface">
              <div className="frontmatter-strip">
                {activeFile ? activeFile.path : "status: draft / author: 未設定"}
              </div>
              <h1>{activeFile ? activeFile.name : "Relic"}</h1>
              {activeFile ? (
                <>
                  <form
                    className="rename-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleRenameFile();
                    }}
                  >
                    <input
                      aria-label="リネーム後のノート名"
                      className="text-input"
                      onChange={(event) => setRenameDraft(event.target.value)}
                      value={renameDraft}
                    />
                    <button disabled={isRenamingFile} type="submit">
                      名前変更
                    </button>
                  </form>
                  <pre className="editor-preview">{activeFile.content || "空のMarkdownファイルです。"}</pre>
                </>
              ) : (
                <p>
                  フェーズ0の仮エディタ画面です。ここからローカルMarkdownワークスペースの実装を育てます。
                </p>
              )}
              <p className="muted">
                IPC: {appInfo ? `${appInfo.name} ${appInfo.version} / ${appInfo.platform}` : "確認中"}
              </p>
            </section>

            {isRightPanelOpen ? (
              <aside className="right-panel">
                <div className="pane-heading">
                  {rightPanelView === "outline" ? "Outline" : "Links"}
                </div>
                <div className="empty-note">
                  {rightPanelView === "outline"
                    ? "見出し一覧はフェーズ4で追加します。"
                    : "バックリンクとアウトゴーイングリンクはフェーズ4で追加します。"}
                </div>
              </aside>
            ) : null}
          </div>
        </main>
      </div>

      <footer className="status-bar">
        <span>Relic</span>
        <span>0 words</span>
      </footer>
    </div>
  );
}
