import type { EditorView } from "@codemirror/view";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { WorkspaceState } from "../shared/ipc";
import type { AppLinkContextMenu } from "./appLinks";
import {
  openFilePathsForTabs,
  registeredWorkspacesForState,
} from "./appShellModel";
import { AppEditorWorkspace } from "./components/AppEditorWorkspace";
import { AppFilesSidebar } from "./components/AppFilesSidebar";
import { AppOverlays } from "./components/AppOverlays";
import { AppRail } from "./components/AppRail";
import { AppStatusBar } from "./components/AppStatusBar";
import { createTranslator, I18nProvider } from "./i18n";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppPaneFileActions } from "./hooks/useAppPaneFileActions";
import { useAppRailNavigation } from "./hooks/useAppRailNavigation";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTabRenderers } from "./hooks/useAppTabRenderers";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppToast } from "./hooks/useAppToast";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { usePaneTabMotion } from "./hooks/usePaneTabMotion";
import { useRailFlights } from "./hooks/useRailFlights";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useSidebarFileInteractions } from "./hooks/useSidebarFileInteractions";
import { useSplitCloseMotion } from "./hooks/useSplitCloseMotion";
import { useWorkspaceAliases } from "./hooks/useWorkspaceAliases";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceGanttCharts } from "./hooks/useWorkspaceGanttCharts";
import { useWorkspaceRenameRailHold } from "./hooks/useWorkspaceRenameRailHold";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore } from "./store/editorStore";
import { useUiStore, type RightPanelView } from "./store/uiStore";
import { collectMarkdownPaths } from "./workspacePaths";
import "./styles.css";

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<AppLinkContextMenu | null>(null);
  const { closeToast, isToastClosing, setWorkspaceError, toastMessage } = useAppToast();
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<string | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<string | undefined>(undefined);
  const [editorActionPulse, setEditorActionPulse] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const {
    clearRailTabFlight,
    railTabFlight,
    showRailTabFlight,
    showSidebarCreateFlight,
    sidebarCreateFlight
  } = useRailFlights();
  const [fileSearchFocusRequest, setFileSearchFocusRequest] = useState(0);
  const [fileSelectionCount, setFileSelectionCount] = useState(0);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const {
    holdWorkspaceRailAfterRename,
    isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail,
    setIsWorkspaceRenameActive
  } = useWorkspaceRenameRailHold();

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
    moveTab,
    openFileInPane,
    openGanttChartInPane,
    openPanelInPane,
    setEditorSettings,
    setFocusedPane,
    setTabActive,
    toggleTabPinned,
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
    closeSidebar,
    toggleRightPanel,
    toggleSidebar: toggleSidebarState,
    toggleTypewriterMode
  } = useUiStore();
  const hasOpenGanttChart = useMemo(
    () => Object.values(tabs).some((tab) => tab.kind === "gantt"),
    [tabs]
  );
  const { isSplitClosing, toggleSplitWithMotion } = useSplitCloseMotion(isSplit, toggleSplit);
  const {
    closeAllTabsInPaneWithMotion,
    closeOtherTabsWithMotion,
    closeTabWithMotion,
    closeTabsToRightWithMotion,
    leftClosingTabIds,
    rightClosingTabIds
  } = usePaneTabMotion({
    closeAllTabsInPane,
    closeOtherTabs,
    closeTab,
    closeTabsToRight,
    leftPane,
    rightPane,
    showRailTabFlight,
    tabs
  });

  const toggleSidebar = useCallback((): void => {
    if (isWorkspaceRenameActive) return;
    toggleSidebarState();
  }, [isWorkspaceRenameActive, toggleSidebarState]);

  const t = useMemo(() => createTranslator(editorSettings.language), [editorSettings.language]);
  const {
    appInfo,
    featureToggles,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  } = useAppSettingsState({
    setEditorSettings,
    setWorkspaceError,
    setWorkspaceState
  });

  const {
    frontmatterCandidates,
    frontmatterSearchFields,
    isSearching,
    searchError,
    searchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery
  } = useWorkspaceSearchState({
    setWorkspaceError,
    userDefinedFields,
    workspaceState
  });

  const requestFileSearchFocus = useCallback((): void => {
    setSidebarView("files");
    setFileSearchFocusRequest((current) => current + 1);
  }, [setSidebarView]);

  const existingMarkdownPaths = useMemo(
    () => collectMarkdownPaths(workspaceState?.fileTree ?? []),
    [workspaceState?.fileTree]
  );
  const aliasesByPath = useWorkspaceAliases({ setWorkspaceError, workspaceState });
  const { ganttCharts, handleUpdateGanttChartEntry, reloadGanttCharts } = useWorkspaceGanttCharts({
    hasOpenGanttChart,
    setWorkspaceError,
    tabs,
    updateTabContent,
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
    handleOpenMarkdownLink,
    handleOpenWikiLink,
    handleOpenWorkspace,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleRenameTreeItem,
    handleTogglePin,
    isCreatingFile,
    isCreatingFolder,
    isCreatingWorkspace,
    isOpeningWorkspace,
    setIsCreatingFile
  } = useWorkspaceFileActions({
    aliasesByPath,
    closeAllTabs,
    closeTab,
    existingMarkdownPaths,
    focusedPane,
    leftPane,
    openFileInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    tabs,
    updateTabMeta,
    workspaceState
  });

  const {
    handleCreateFileFromSidebar,
    handleCreateFolderFromSidebar,
    handleSidebarOpenFile
  } = useSidebarFileInteractions({
    focusedPane,
    handleCreateFile,
    handleCreateFolder,
    handleOpenFile,
    openFileInPane,
    setTabActive,
    setWorkspaceError,
    showRailTabFlight,
    showSidebarCreateFlight,
    t
  });

  const handleFileSaved = useCallback((): void => {
    void reloadGanttCharts();
  }, [reloadGanttCharts]);

  useAppTheme(editorSettings.theme);

  useAppKeyboardShortcuts({
    closeTab: closeTabWithMotion,
    focusedPane,
    leftPane,
    requestFileSearchFocus,
    rightPane,
    setIsCreatingFile,
    setShowCommandPalette,
    setShowQuickSwitcher,
    setSidebarView,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit: toggleSplitWithMotion,
    toggleTypewriterMode
  });

  const { sidebarWidth, isSidebarResizing, startSidebarResize } = useSidebarResize({
    initialWidth: 260,
    maxWidth: 500,
    minWidth: 180
  });
  const {
    sidebarWidth: rightPanelWidth,
    isSidebarResizing: isRightPanelResizing,
    startSidebarResize: startRightPanelResize
  } = useSidebarResize({
    direction: "left",
    initialWidth: 240,
    maxWidth: 520,
    minWidth: 220
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

  const {
    handleCreateFileInFolder,
    handleCreateFolderInFolder,
    handleDuplicateTabFile,
    handleRevealTabFile,
    handleRevealWorkspaceItem,
    handleSelectFolder,
    openFileInOtherPane,
    openTreeFileInOtherPane,
    openWorkspacePathInOtherPane
  } = useAppPaneFileActions({
    focusedPane,
    handleDuplicateTreeFile,
    isSplit,
    openFileInPane,
    openGanttChartInPane,
    openPanelInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs
  });

  const registeredWorkspaces = useMemo(
    () => registeredWorkspacesForState(workspaceState),
    [workspaceState]
  );
  const pinnedPathSet = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const openFilePathSet = useMemo(
    () => openFilePathsForTabs(tabs),
    [tabs]
  );

  const {
    activeFilePathForGraph,
    activeFileTabInFocusedPane,
    backlinks,
    isLoadingBacklinks,
    outlineHeadings,
    outgoingLinks
  } = useActiveDocumentContext({
    aliasesByPath,
    existingMarkdownPaths,
    fileTree: workspaceState?.fileTree,
    focusedPane,
    leftPane,
    rightPane,
    setWorkspaceError,
    tabs
  });

  const commands = useCommandPaletteCommands({
    activeFileName: activeFileTabInFocusedPane?.name ?? null,
    handleDeleteActiveFile,
    handleDuplicateActiveFile,
    requestFileSearchFocus,
    setIsCreatingFile,
    setShowQuickSwitcher,
    setSidebarView,
    t,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit: toggleSplitWithMotion,
    toggleTypewriterMode
  });

  const {
    activePanelTabIds,
    chartRailView,
    handleRailChartButton,
    handleRailPanelButton,
    isChartTabActive,
    isChartTabOpen,
    openPanelTabIds,
    panelRailViews,
    primaryRailViews,
    renderPanelTabIcon,
    sidebarViews
  } = useAppRailNavigation({
    activeSidebarView,
    clearRailTabFlight,
    closeSidebar,
    featureToggles,
    focusedPane,
    leftPane,
    openGanttChartInPane,
    openPanelInPane,
    rightPane,
    setSidebarView,
    setTabActive,
    showRailTabFlight,
    t,
    tabs
  });

  const { renderGanttChartTab, renderPanelTab } = useAppTabRenderers({
    activeFilePathForGraph,
    appInfo,
    editorSettings,
    featureToggles,
    ganttCharts,
    handleOpenFile,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleUpdateGanttChartEntry,
    userDefinedFields,
    workspaceState
  });

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className="app-shell">
      <div className="title-bar" />
      <div className="workspace">
        <AppRail
          activePanelTabIds={activePanelTabIds}
          activeSidebarView={activeSidebarView}
          activeWorkspaceId={workspaceState?.activeWorkspace?.id ?? null}
          chartRailView={chartRailView}
          isChartTabActive={isChartTabActive}
          isChartTabOpen={isChartTabOpen}
          isSidebarOpen={isSidebarOpen}
          isWorkspaceRenameActive={isWorkspaceRenameActive}
          isWorkspaceRenameHoldingRail={isWorkspaceRenameHoldingRail}
          onChartButton={handleRailChartButton}
          onCloseSidebar={closeSidebar}
          onPanelButton={handleRailPanelButton}
          onRemoveWorkspace={handleRemoveWorkspace}
          onRenameActiveChange={setIsWorkspaceRenameActive}
          onRenameComplete={holdWorkspaceRailAfterRename}
          onRenameWorkspace={handleRenameWorkspace}
          onSetSidebarView={setSidebarView}
          onSwitchWorkspace={handleSwitchWorkspace}
          openPanelTabIds={openPanelTabIds}
          panelRailViews={panelRailViews}
          primaryRailViews={primaryRailViews}
          registeredWorkspaces={registeredWorkspaces}
          renameLabel={t("files.rename")}
          removeWorkspaceLabel={(name) => t("files.removeWorkspace", { name })}
          viewSwitcherLabel={t("nav.viewSwitcher")}
          workspacesLabel={t("files.registeredWorkspaces")}
        />

        <AppFilesSidebar
          activeSidebarView={activeSidebarView}
          fileSelectionCount={fileSelectionCount}
          isCreatingFile={isCreatingFile}
          isCreatingFolder={isCreatingFolder}
          isCreatingWorkspace={isCreatingWorkspace}
          isOpeningWorkspace={isOpeningWorkspace}
          isSearching={isSearching}
          isSidebarOpen={isSidebarOpen}
          isSidebarResizing={isSidebarResizing}
          onCreateFile={handleCreateFileFromSidebar}
          onCreateFileInFolder={handleCreateFileInFolder}
          onCreateFolder={handleCreateFolderFromSidebar}
          onCreateFolderInFolder={handleCreateFolderInFolder}
          onCreateWorkspace={handleCreateNewWorkspace}
          onDeleteItem={handleDeleteTreeItem}
          onDeleteItems={handleDeleteTreeItems}
          onDuplicateFile={handleDuplicateTreeFile}
          onMoveFile={handleMoveFile}
          onMoveFolder={handleMoveFolder}
          onMoveItems={handleMoveTreeItems}
          onOpenFile={handleSidebarOpenFile}
          onOpenInOtherPane={isSplit ? openTreeFileInOtherPane : undefined}
          onOpenWorkspace={handleOpenWorkspace}
          onRevealItem={handleRevealWorkspaceItem}
          onRenameItem={handleRenameTreeItem}
          onSearchFrontmatterFieldChange={setSearchFrontmatterField}
          onSearchModeChange={setSearchMode}
          onSearchQueryChange={setSearchQuery}
          onSelectFolder={handleSelectFolder}
          onSelectedCountChange={setFileSelectionCount}
          onTogglePin={handleTogglePin}
          openFilePaths={openFilePathSet}
          searchError={searchError}
          searchFocusRequest={fileSearchFocusRequest}
          searchFrontmatterCandidates={frontmatterCandidates}
          searchFrontmatterField={searchFrontmatterField}
          searchFrontmatterFields={frontmatterSearchFields}
          searchMode={searchMode}
          searchQuery={searchQuery}
          searchResults={searchResults}
          selectedCountLabel={t("files.selectedCount", { count: fileSelectionCount })}
          sidebarViews={sidebarViews}
          sidebarWidth={sidebarWidth}
          startSidebarResize={startSidebarResize}
          workspaceState={workspaceState}
        />

        <AppEditorWorkspace
          allFilePaths={existingMarkdownPaths}
          backlinks={backlinks}
          editorActionPulse={editorActionPulse}
          editorSettings={editorSettings}
          focusedPane={focusedPane}
          frontmatterCandidates={frontmatterCandidates}
          isLoadingBacklinks={isLoadingBacklinks}
          isRightPanelOpen={isRightPanelOpen}
          isRightPanelResizing={isRightPanelResizing}
          isSourceMode={isSourceMode}
          isSplit={isSplit}
          isSplitClosing={isSplitClosing}
          isTypewriterMode={isTypewriterMode}
          leftClosingTabIds={leftClosingTabIds}
          leftEditorViewRef={leftEditorViewRef}
          leftPaneScrollHeading={leftPaneScrollHeading}
          onCloseAllTabsInPane={closeAllTabsInPaneWithMotion}
          onCloseOtherTabs={closeOtherTabsWithMotion}
          onCloseTabsToRight={closeTabsToRightWithMotion}
          onCreateFile={handleCreateNoteFromPane}
          onDuplicateTabFile={handleDuplicateTabFile}
          onEditorAction={() => setEditorActionPulse((value) => value + 1)}
          onFileSaved={handleFileSaved}
          onOpenFile={handleOpenFile}
          onOpenInOtherPane={openFileInOtherPane}
          onOpenLink={handleOpenMarkdownLink}
          onOpenWikiLink={handleOpenWikiLink}
          onOutlineHeadingClick={(heading) => {
            const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;
            setScrollHeading(heading);
          }}
          onRenameFile={(path, name) => handleRenameTreeItem(path, "file", name)}
          onRevealTabFile={handleRevealTabFile}
          onRightPanelResizeStart={startRightPanelResize}
          onRightPanelViewButton={handleRightPanelViewButton}
          onScrollTargetHandled={(pane) => {
            if (pane === "left") {
              setLeftPaneScrollHeading(undefined);
              return;
            }

            setRightPaneScrollHeading(undefined);
          }}
          onSetFocusedPane={setFocusedPane}
          onSourceModeToggle={() => setIsSourceMode((value) => !value)}
          onSplitToggle={toggleSplitWithMotion}
          onTabClose={closeTabWithMotion}
          onTabMove={moveTab}
          onTabSelect={setTabActive}
          onTogglePinTab={toggleTabPinned}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          renderGanttChartTab={renderGanttChartTab}
          renderPanelTab={renderPanelTab}
          renderPanelTabIcon={renderPanelTabIcon}
          rightClosingTabIds={rightClosingTabIds}
          rightEditorViewRef={rightEditorViewRef}
          rightPaneScrollHeading={rightPaneScrollHeading}
          rightPanelView={rightPanelView}
          rightPanelWidth={rightPanelWidth}
          setLinkContextMenu={setLinkContextMenu}
          showRightPanelControls={featureToggles.rightPanel}
          userDefinedFields={userDefinedFields}
          workspacePath={workspaceState?.activeWorkspace?.path}
        />
      </div>

      <AppStatusBar activeFileTab={activeFileTabInFocusedPane} />

      <AppOverlays
        aliasesByPath={aliasesByPath}
        closeToast={closeToast}
        commands={commands}
        existingMarkdownPaths={existingMarkdownPaths}
        handleOpenFile={handleOpenFile}
        handleOpenWikiLink={handleOpenWikiLink}
        handleRevealWorkspaceItem={handleRevealWorkspaceItem}
        isSplit={isSplit}
        isToastClosing={isToastClosing}
        linkContextMenu={linkContextMenu}
        openWorkspacePathInOtherPane={openWorkspacePathInOtherPane}
        railTabFlight={railTabFlight}
        setLinkContextMenu={setLinkContextMenu}
        setShowCommandPalette={setShowCommandPalette}
        setShowQuickSwitcher={setShowQuickSwitcher}
        showCommandPalette={showCommandPalette}
        showQuickSwitcher={showQuickSwitcher}
        sidebarCreateFlight={sidebarCreateFlight}
        toastMessage={toastMessage}
      />
    </div>
    </I18nProvider>
  );
}
