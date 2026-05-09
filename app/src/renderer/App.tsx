import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  WorkspaceState,
  WorkspaceTreeNode
} from "../shared/ipc";
import { resolveWikiLinks } from "../shared/links";
import { CommandPalette } from "./components/CommandPalette";
import { FilesSidebar } from "./components/FilesSidebar";
import { FrontmatterForm } from "./components/FrontmatterForm";
import { GitSidebar } from "./components/GitSidebar";
import { PaneView } from "./components/PaneView";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { SearchSidebar } from "./components/SearchSidebar";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { ToolsSidebar } from "./components/ToolsSidebar";
import { Toolbar } from "./components/Toolbar";
import { extractOutlineHeadings, getActiveTabInPane } from "./editorDerivedState";
import { createTranslator, I18nProvider, useT, type TranslationKey } from "./i18n";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTheme } from "./hooks/useAppTheme";
import { useBacklinksState } from "./hooks/useBacklinksState";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { useGitPanelState } from "./hooks/useGitPanelState";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore, type PaneId } from "./store/editorStore";
import { useUiStore, type RightPanelView, type SidebarView } from "./store/uiStore";
import { collectMarkdownPaths } from "./workspacePaths";
import "./styles.css";

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

interface RailWorkspaceSwitcherProps {
  activeWorkspaceId: string | null;
  ariaLabel: string;
  onRemoveWorkspace: (id: string) => void;
  onSwitchWorkspace: (id: string) => void;
  removeLabel: (name: string) => string;
  workspaces: WorkspaceState["workspaces"];
}

function RailWorkspaceSwitcher({
  activeWorkspaceId,
  ariaLabel,
  onRemoveWorkspace,
  onSwitchWorkspace,
  removeLabel,
  workspaces
}: RailWorkspaceSwitcherProps): ReactElement | null {
  if (workspaces.length === 0) return null;

  return (
    <div className="workspace-switcher" aria-label={ariaLabel}>
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        const initial = ws.name.trim().charAt(0).toUpperCase() || "W";

        return (
          <div className={`workspace-switcher-item${isActive ? " active" : ""}`} key={ws.id}>
            <button
              aria-label={ws.name}
              className="workspace-switcher-main"
              onClick={() => onSwitchWorkspace(ws.id)}
              title={ws.path}
              type="button"
            >
              <span className="workspace-switcher-icon">{initial}</span>
              <span className="workspace-switcher-name">{ws.name}</span>
            </button>
            <button
              aria-label={removeLabel(ws.name)}
              className="workspace-switcher-remove"
              onClick={() => onRemoveWorkspace(ws.id)}
              title={removeLabel(ws.name)}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
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
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<string | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<string | undefined>(undefined);
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
    updateTabContent,
    updateTabMeta
  } = useEditorStore();

  const {
    activeSidebarView,
    isRightPanelOpen,
    isSidebarOpen,
    isTypewriterMode,
    rightPanelView,
    setRightPanelView,
    setSidebarView,
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

  const {
    appInfo,
    autoSyncSettings,
    featureToggles,
    frontmatterTemplates,
    gitHubIntegrationSettings,
    handleSaveAutoSyncSettings,
    handleSaveFeatureToggles,
    handleSaveFrontmatterTemplates,
    handleSaveGitHubIntegrationSettings,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    markdownTemplates,
    selectedTemplatePath,
    setSelectedTemplatePath,
    userDefinedFields
  } = useAppSettingsState({
    setEditorSettings,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  });

  const gitPanel = useGitPanelState({
    gitHubIntegrationSettings,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  });

  const {
    gitStatus,
    gitHubAuthStatus,
    gitRemotes,
    gitBranches,
    gitCommitHistory,
    gitTags,
    gitWorkingChanges,
    selectedGitCommitHash,
    selectedGitCommitDiff,
    newGitBranchName,
    newGitTagName,
    newGitTagMessage,
    gitRemoteUrl,
    gitSyncMessage,
    gitErrorMessage,
    gitRetryAction,
    pendingGitBranchSwitch,
    gitCommitMessage,
    gitSyncPreview,
    gitSyncStep,
    gitConflicts,
    gitCloneUrl,
    isCreatingGitBranch,
    isCreatingGitCommit,
    isCreatingGitTag,
    isConnectingGitHub,
    isConnectingGitRemote,
    isDeletingGitTag,
    isDisconnectingGitHub,
    isPullingGitBranch,
    isPushingGitBranch,
    pushingGitTagName,
    isSwitchingGitBranch,
    isCloningGitHub,
    isResolvingConflict,
    handleInitializeGitRepository,
    handleCloneGitHubRepository,
    handleConnectGitHubAccount,
    handleDisconnectGitHubAccount,
    handleConnectGitRemote,
    handlePushGitBranch,
    handlePullGitBranch,
    handleConfirmPush,
    handleConfirmPull,
    handleCreateGitBranch,
    handleSwitchGitBranch,
    handleCommitAndSwitchGitBranch,
    handleCreateGitCommit,
    handleCreateGitTag,
    handleDeleteGitTag,
    handlePushGitTag,
    handleResolveConflict,
    setSelectedGitCommitHash,
    setNewGitBranchName,
    setNewGitTagName,
    setNewGitTagMessage,
    setGitRemoteUrl,
    setGitSyncStep,
    setPendingGitBranchSwitch,
    setGitCommitMessage,
    setGitCloneUrl
  } = gitPanel;

  const {
    frontmatterCandidates,
    handleTagSearch,
    searchError,
    searchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery,
    workspaceTags
  } = useWorkspaceSearchState({
    setSidebarView,
    setWorkspaceError,
    userDefinedFields,
    workspaceState
  });

  const {
    handleDeleteActiveFile,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateActiveFile,
    handleDuplicateTreeFile,
    handleCreateFile,
    handleCreateFolder,
    handleCreateNewWorkspace,
    handleCreateNoteFromPane,
    handleOpenFile,
    handleOpenWikiLink,
    handleOpenWorkspace,
    handleRefreshWorkspaceState,
    handleRemoveWorkspace,
    handleSwitchWorkspace,
    handleMoveActiveFile,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleRenameActiveFile,
    handleRenameTreeItem,
    handleTogglePin,
    isCreatingFile,
    isCreatingFolder,
    isCreatingWorkspace,
    isOpeningWorkspace,
    setIsCreatingFile
  } = useWorkspaceFileActions({
    closeAllTabs,
    closeTab,
    focusedPane,
    leftPane,
    openFileInPane,
    rightPane,
    selectedTemplatePath,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    tabs,
    updateTabMeta,
    workspaceState
  });

  useAppTheme(editorSettings.theme);

  useAppKeyboardShortcuts({
    closeTab,
    focusedPane,
    leftPane,
    rightPane,
    setIsCreatingFile,
    setShowCommandPalette,
    setShowQuickSwitcher,
    setSidebarView,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit,
    toggleTypewriterMode
  });

  const { sidebarWidth, startSidebarResize } = useSidebarResize({
    initialWidth: 260,
    maxWidth: 500,
    minWidth: 180
  });

  const leftEditorViewRef = useRef<EditorView | null>(null);
  const rightEditorViewRef = useRef<EditorView | null>(null);

  const handleRightPanelViewButton = useCallback((view: RightPanelView): void => {
    if (isRightPanelOpen && rightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [isRightPanelOpen, rightPanelView, setRightPanelView, toggleRightPanel]);

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

  const registeredWorkspaces = useMemo(
    () =>
      workspaceState && workspaceState.workspaces.length > 0
        ? workspaceState.workspaces
        : workspaceState?.activeWorkspace
          ? [workspaceState.activeWorkspace]
          : [],
    [workspaceState]
  );
  const existingMarkdownPaths = useMemo(
    () => collectMarkdownPaths(workspaceState?.fileTree ?? []),
    [workspaceState?.fileTree]
  );

  // ──────────────────
  // アウトライン（右パネル）
  // ──────────────────

  const activeTabInFocusedPane = getActiveTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );

  const outlineHeadings = activeTabInFocusedPane
    ? extractOutlineHeadings(activeTabInFocusedPane.content)
    : [];
  const outgoingLinks = activeTabInFocusedPane
    ? resolveWikiLinks(activeTabInFocusedPane.content, activeTabInFocusedPane.path, existingMarkdownPaths)
    : [];

  const { backlinks, isLoadingBacklinks } = useBacklinksState({
    activeFilePath: activeTabInFocusedPane?.path ?? null,
    fileTree: workspaceState?.fileTree,
    setWorkspaceError
  });

  const commands = useCommandPaletteCommands({
    activeFileName: activeTabInFocusedPane?.name ?? null,
    gitBranches,
    handleDeleteActiveFile,
    handleDuplicateActiveFile,
    handlePullGitBranch,
    handlePushGitBranch,
    handleSwitchGitBranch,
    setIsCreatingFile,
    setShowQuickSwitcher,
    setSidebarView,
    t,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit,
    toggleTypewriterMode
  });

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className="app-shell">
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
            <span className="rail-button-label">{t("pane.toggleSidebar")}</span>
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
                <span className="rail-button-label">{view.label}</span>
              </button>
            ))}
          {registeredWorkspaces.length > 0 ? (
            <>
              <div className="rail-spacer" />
              <div className="rail-separator" />
              <RailWorkspaceSwitcher
                activeWorkspaceId={workspaceState?.activeWorkspace?.id ?? null}
                ariaLabel={t("files.registeredWorkspaces")}
                onRemoveWorkspace={handleRemoveWorkspace}
                onSwitchWorkspace={handleSwitchWorkspace}
                removeLabel={(name) => t("files.removeWorkspace", { name })}
                workspaces={registeredWorkspaces}
              />
            </>
          ) : null}
        </nav>

        {/* サイドバー */}
          <aside
            aria-hidden={!isSidebarOpen}
            className={`sidebar${isSidebarOpen ? "" : " sidebar--closed"}`}
            style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
          >
            <div className="sidebar-header">
              <div className="pane-heading">
                {sidebarViews.find((v) => v.id === activeSidebarView)?.label}
              </div>
            </div>
            <div className="sidebar-body">
            {activeSidebarView === "files" ? (
              <FilesSidebar
                isCreatingFile={isCreatingFile}
                isCreatingFolder={isCreatingFolder}
                isCreatingWorkspace={isCreatingWorkspace}
                isOpeningWorkspace={isOpeningWorkspace}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onCreateWorkspace={handleCreateNewWorkspace}
                onDeleteItem={handleDeleteTreeItem}
                onDeleteItems={handleDeleteTreeItems}
                onDuplicateFile={handleDuplicateTreeFile}
                onMoveFile={handleMoveFile}
                onMoveFolder={handleMoveFolder}
                onMoveItems={handleMoveTreeItems}
                onOpenFile={handleOpenFile}
                onOpenWorkspace={handleOpenWorkspace}
                onRenameItem={handleRenameTreeItem}
                onSelectFolder={handleSelectFolder}
                onTogglePin={handleTogglePin}
                onTemplatePathChange={setSelectedTemplatePath}
                selectedTemplatePath={selectedTemplatePath}
                templates={markdownTemplates}
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
              <GitSidebar
                gitStatus={gitStatus}
                gitHubAuthStatus={gitHubAuthStatus}
                gitRemotes={gitRemotes}
                gitBranches={gitBranches}
                gitCommitHistory={gitCommitHistory}
                gitTags={gitTags}
                gitWorkingChanges={gitWorkingChanges}
                selectedGitCommitHash={selectedGitCommitHash}
                selectedGitCommitDiff={selectedGitCommitDiff}
                newGitBranchName={newGitBranchName}
                newGitTagName={newGitTagName}
                newGitTagMessage={newGitTagMessage}
                gitRemoteUrl={gitRemoteUrl}
                gitSyncMessage={gitSyncMessage}
                gitErrorMessage={gitErrorMessage}
                gitRetryAction={gitRetryAction}
                pendingGitBranchSwitch={pendingGitBranchSwitch}
                gitCommitMessage={gitCommitMessage}
                gitSyncPreview={gitSyncPreview}
                gitSyncStep={gitSyncStep}
                gitConflicts={gitConflicts}
                gitCloneUrl={gitCloneUrl}
                isCreatingGitBranch={isCreatingGitBranch}
                isCreatingGitCommit={isCreatingGitCommit}
                isCreatingGitTag={isCreatingGitTag}
                isConnectingGitHub={isConnectingGitHub}
                isConnectingGitRemote={isConnectingGitRemote}
                isDeletingGitTag={isDeletingGitTag}
                isDisconnectingGitHub={isDisconnectingGitHub}
                isPullingGitBranch={isPullingGitBranch}
                isPushingGitBranch={isPushingGitBranch}
                pushingGitTagName={pushingGitTagName}
                isSwitchingGitBranch={isSwitchingGitBranch}
                isCloningGitHub={isCloningGitHub}
                isResolvingConflict={isResolvingConflict}
                hasWorkspace={!!workspaceState?.activeWorkspace}
                onInitializeGitRepository={handleInitializeGitRepository}
                onCloneGitHubRepository={handleCloneGitHubRepository}
                onConnectGitHubAccount={handleConnectGitHubAccount}
                onDisconnectGitHubAccount={handleDisconnectGitHubAccount}
                onConnectGitRemote={handleConnectGitRemote}
                onPushGitBranch={handlePushGitBranch}
                onPullGitBranch={handlePullGitBranch}
                onConfirmPush={handleConfirmPush}
                onConfirmPull={handleConfirmPull}
                onCreateGitBranch={handleCreateGitBranch}
                onSwitchGitBranch={handleSwitchGitBranch}
                onCommitAndSwitchGitBranch={handleCommitAndSwitchGitBranch}
                onCreateGitCommit={handleCreateGitCommit}
                onCreateGitTag={handleCreateGitTag}
                onDeleteGitTag={handleDeleteGitTag}
                onPushGitTag={handlePushGitTag}
                onResolveConflict={handleResolveConflict}
                onSelectCommitHash={setSelectedGitCommitHash}
                onSetNewGitBranchName={setNewGitBranchName}
                onSetNewGitTagName={setNewGitTagName}
                onSetNewGitTagMessage={setNewGitTagMessage}
                onSetGitRemoteUrl={setGitRemoteUrl}
                onSetGitSyncStep={setGitSyncStep}
                onSetPendingGitBranchSwitch={setPendingGitBranchSwitch}
                onSetGitCommitMessage={setGitCommitMessage}
                onSetGitCloneUrl={setGitCloneUrl}
              />
            ) : activeSidebarView === "tools" ? (
              <ToolsSidebar workspacePath={workspaceState?.activeWorkspace?.path ?? null} />
            ) : (
              <SettingsSidebar
                appInfo={appInfo}
                autoSyncSettings={autoSyncSettings}
                featureToggles={featureToggles}
                frontmatterTemplates={frontmatterTemplates}
                gitHubIntegrationSettings={gitHubIntegrationSettings}
                onAutoSyncSave={handleSaveAutoSyncSettings}
                onFeatureTogglesSave={handleSaveFeatureToggles}
                onFrontmatterTemplatesSave={handleSaveFrontmatterTemplates}
                onGitHubIntegrationSave={handleSaveGitHubIntegrationSettings}
                onSave={handleSaveSettings}
                onUserDefinedFieldsSave={handleSaveUserDefinedFields}
                settings={editorSettings}
                userDefinedFields={userDefinedFields}
              />
            )}
            <div
              className="sidebar-resize-handle"
              onMouseDown={startSidebarResize}
            />
            </div>
          </aside>

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
                {t("pane.splitShort")}
              </button>
              {featureToggles.rightPanel && (
                <>
                  <button
                    className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
                    onClick={() => handleRightPanelViewButton("outline")}
                    title={t("pane.toggleOutline")}
                    type="button"
                  >
                    {t("pane.outline")}
                  </button>
                  {featureToggles.frontmatter ? (
                    <button
                      className={`toolbar-btn${rightPanelView === "frontmatter" && isRightPanelOpen ? " active" : ""}`}
                      onClick={() => handleRightPanelViewButton("frontmatter")}
                      title={t("pane.toggleFrontmatter")}
                      type="button"
                    >
                      {t("pane.frontmatter")}
                    </button>
                  ) : null}
                  <button
                    className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
                    onClick={() => handleRightPanelViewButton("links")}
                    title={t("pane.toggleLinks")}
                    type="button"
                  >
                    {t("pane.links")}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="editor-layout">
            <div className="editor-workspace">
              <div className="shared-editor-toolbar">
                <Toolbar
                  fallbackViewRef={focusedPane === "left" ? rightEditorViewRef : leftEditorViewRef}
                  viewRef={focusedPane === "left" ? leftEditorViewRef : rightEditorViewRef}
                />
              </div>
              <div className={`panes-container${isSplit ? " panes-container--split" : ""}`}>
                <PaneView
                  allFilePaths={existingMarkdownPaths}
                  editorSettings={editorSettings}
                  focusedPane={focusedPane}
                  onCreateFile={handleCreateNoteFromPane}
                  onFocus={() => setFocusedPane("left")}
                  onScrollTargetHandled={() => setLeftPaneScrollHeading(undefined)}
                  onTabClose={(tabId) => closeTab("left", tabId)}
                  onTabSelect={(tabId) => setTabActive("left", tabId)}
                  onCloseOtherTabs={(tabId) => closeOtherTabs("left", tabId)}
                  onCloseTabsToRight={(tabId) => closeTabsToRight("left", tabId)}
                  onCloseAllTabs={() => closeAllTabsInPane("left")}
                  onOpenInOtherPane={(tabId) => openFileInOtherPane("left", tabId)}
                  isSplitView={isSplit}
                  pane="left"
                  scrollTargetHeading={leftPaneScrollHeading}
                  typewriterMode={isTypewriterMode}
                  viewRef={leftEditorViewRef}
                  workspacePath={workspaceState?.activeWorkspace?.path}
                />
                {isSplit ? (
                  <PaneView
                    allFilePaths={existingMarkdownPaths}
                    editorSettings={editorSettings}
                    focusedPane={focusedPane}
                    onCreateFile={handleCreateNoteFromPane}
                    onFocus={() => setFocusedPane("right")}
                    onScrollTargetHandled={() => setRightPaneScrollHeading(undefined)}
                    onTabClose={(tabId) => closeTab("right", tabId)}
                    onTabSelect={(tabId) => setTabActive("right", tabId)}
                    onCloseOtherTabs={(tabId) => closeOtherTabs("right", tabId)}
                    onCloseTabsToRight={(tabId) => closeTabsToRight("right", tabId)}
                    onCloseAllTabs={() => closeAllTabsInPane("right")}
                    onOpenInOtherPane={(tabId) => openFileInOtherPane("right", tabId)}
                    isSplitView={isSplit}
                    pane="right"
                    scrollTargetHeading={rightPaneScrollHeading}
                    typewriterMode={isTypewriterMode}
                    viewRef={rightEditorViewRef}
                    workspacePath={workspaceState?.activeWorkspace?.path}
                  />
                ) : null}
              </div>
            </div>

              <aside
                aria-hidden={!isRightPanelOpen}
                className={`right-panel${isRightPanelOpen ? "" : " right-panel--closed"}`}
              >
                <div className="sidebar-header">
                  <div className="pane-heading">
                    {rightPanelView === "outline"
                      ? t("pane.outline")
                      : rightPanelView === "frontmatter"
                        ? t("pane.frontmatter")
                        : t("pane.links")}
                  </div>
                </div>
                <div className="sidebar-body">
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
                ) : rightPanelView === "frontmatter" ? (
                  activeTabInFocusedPane ? (
                    <div className="frontmatter-panel">
                      <FrontmatterForm
                        candidates={frontmatterCandidates}
                        content={activeTabInFocusedPane.content}
                        key={`fm-panel-${activeTabInFocusedPane.id}`}
                        onChange={(content) => updateTabContent(activeTabInFocusedPane.id, content)}
                        onUserDefinedFieldsChange={handleSaveUserDefinedFields}
                        frontmatterTemplates={frontmatterTemplates}
                        userDefinedFields={userDefinedFields}
                        workspaceTags={workspaceTags.map((tag) => tag.tag)}
                      />
                    </div>
                  ) : (
                    <div className="empty-note">{t("pane.noFiles")}</div>
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
                </div>
              </aside>
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
        {t("pane.moveShort")}
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
