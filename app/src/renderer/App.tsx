import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { WorkspaceState } from "../shared/ipc";
import type { AppLinkContextMenu } from "./appLinks";
import {
  openFilePathsForTabs,
  registeredWorkspacesForState,
  titleBarLeftOffset,
} from "./appShellModel";
import { AppEditorWorkspace } from "./components/AppEditorWorkspace";
import { AppFilesSidebar } from "./components/AppFilesSidebar";
import { AppOverlays } from "./components/AppOverlays";
import { AppRail } from "./components/AppRail";
import { AppStatusBar } from "./components/AppStatusBar";
import { AppTitleBar } from "./components/AppTitleBar";
import { I18nProvider } from "./i18n";
import { createTranslator } from "./i18nModel";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppPaneFileActions } from "./hooks/useAppPaneFileActions";
import { useAppRailNavigation } from "./hooks/useAppRailNavigation";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTabRenderers } from "./hooks/useAppTabRenderers";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppToast } from "./hooks/useAppToast";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { useEditorAutoSave } from "./hooks/useEditorAutoSave";
import { usePaneTabMotion } from "./hooks/usePaneTabMotion";
import { useRailFlights } from "./hooks/useRailFlights";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useSidebarFileInteractions } from "./hooks/useSidebarFileInteractions";
import { useSplitCloseMotion } from "./hooks/useSplitCloseMotion";
import { useWorkspaceAliases } from "./hooks/useWorkspaceAliases";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceChronicleCalendars } from "./hooks/useWorkspaceChronicleCalendars";
import { useWorkspaceCharts } from "./hooks/useWorkspaceCharts";
import { useWorkspaceRenameRailHold } from "./hooks/useWorkspaceRenameRailHold";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { matchesAnyTreeItemPath } from "./hooks/workspaceFileActionHelpers";
import { buildPreviewOutputHtml } from "./outputHtml";
import { useEditorStore, type PaneId } from "./store/editorStore";
import { useUiStore, type RightPanelView, type SidebarView } from "./store/uiStore";
import { collectMarkdownPaths } from "./workspacePaths";
import "./styles.css";

const RAIL_WIDTH = 48;
const TITLE_BAR_TRAFFIC_LIGHT_SPACE = 88;

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<AppLinkContextMenu | null>(null);
  const { closeToast, isToastClosing, setWorkspaceError, showToast, toastMessage } = useAppToast();
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
    markTabSaved,
    rightPane,
    tabs,
    setTabExternalConflict,
    closeAllTabs,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabsInPane,
    moveTab,
    openFileInPane,
    openChartInPane,
    openPanelInPane,
    setEditorSettings,
    setFocusedPane,
    setTabActive,
    toggleTabPinned,
    toggleSplit,
    updateTabContent,
    updateTabFromExternal,
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
  const hasOpenChart = useMemo(
    () => Object.values(tabs).some((tab) => tab.kind === "chart"),
    [tabs]
  );
  const { isSplitClosing, toggleSplitWithMotion } = useSplitCloseMotion(isSplit, toggleSplit);

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
    searchLimitNotice,
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
  const { charts, handleUpdateChartEntry, reloadCharts } = useWorkspaceCharts({
    hasOpenChart,
    setWorkspaceError,
    tabs,
    updateTabContent,
    workspaceState
  });
  const { chronicleCalendars, handleSaveChronicleCalendars } = useWorkspaceChronicleCalendars({
    onSaved: () => { void reloadCharts(); },
    setWorkspaceError,
    workspaceState
  });

  const handleFileSaved = useCallback((): void => {
    void reloadCharts();
  }, [reloadCharts]);

  const { flushTabsBeforeClose, saveStatusByTabId } = useEditorAutoSave({
    conflictCloseBlockedMessage: t("pane.externalConflictCloseBlocked"),
    onSaved: handleFileSaved,
    onSaveError: setWorkspaceError,
    tabs
  });
  const ensureCanCloseTabs = useCallback((_pane: PaneId, tabIds: string[]): Promise<boolean> | boolean => {
    const currentTabs = useEditorStore.getState().tabs;
    const needsSaveCheck = tabIds.some((tabId) => {
      const tab = currentTabs[tabId];
      return tab?.kind === "file" && (Boolean(tab.externalConflict) || tab.content !== tab.savedContent);
    });

    if (!needsSaveCheck) return true;

    return (async () => {
    const result = await flushTabsBeforeClose(tabIds);
    if (!result.ok) {
      setWorkspaceError(result.message ?? "ファイルを保存できませんでした。");
      return false;
    }

    return true;
    })();
  }, [flushTabsBeforeClose, setWorkspaceError]);
  const ensureCanCloseAllTabs = useCallback((): Promise<boolean> | boolean => {
    const currentTabs = useEditorStore.getState().tabs;
    const tabIds = Object.keys(currentTabs);
    const needsSaveCheck = Object.values(currentTabs).some((tab) => {
      return tab.kind === "file" && (Boolean(tab.externalConflict) || tab.content !== tab.savedContent);
    });

    if (!needsSaveCheck) return true;

    return (async () => {
    const result = await flushTabsBeforeClose(tabIds);
    if (!result.ok) {
      setWorkspaceError(result.message ?? "ファイルを保存できませんでした。");
      return false;
    }

    return true;
    })();
  }, [flushTabsBeforeClose, setWorkspaceError]);
  const ensureCanMutateWorkspaceItems = useCallback((
    items: Array<{ path: string; type: "file" | "folder" }>
  ): Promise<boolean> | boolean => {
    const currentTabs = useEditorStore.getState().tabs;
    const targetTabIds = Object.entries(currentTabs).reduce<string[]>((acc, [tabId, tab]) => {
      if (tab.kind === "file" && matchesAnyTreeItemPath(tab.path, items)) acc.push(tabId);
      return acc;
    }, []);

    if (targetTabIds.length === 0) return true;
    return ensureCanCloseTabs(focusedPane, targetTabIds);
  }, [ensureCanCloseTabs, focusedPane]);

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
    beforeCloseAllTabs: ensureCanCloseAllTabs,
    beforeMutateWorkspaceItems: ensureCanMutateWorkspaceItems,
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
    t,
    updateTabMeta,
    workspaceState
  });

  const {
    handleCreateFileFromSidebar,
    handleCreateFolderFromSidebar,
    handleSidebarOpenFile,
    openingFilePath
  } = useSidebarFileInteractions({
    focusedPane,
    handleCreateFile,
    handleCreateFolder,
    handleOpenFile,
    onFileOpenMotion: () => setEditorActionPulse((value) => value + 1),
    openFileInPane,
    setTabActive,
    setWorkspaceError,
    showRailTabFlight,
    showSidebarCreateFlight,
    t
  });

  const {
    closeAllTabsInPaneWithMotion,
    closeOtherTabsWithMotion,
    closeTabWithMotion,
    closeTabsToRightWithMotion,
    leftClosingTabIds,
    rightClosingTabIds
  } = usePaneTabMotion({
    beforeCloseTabs: ensureCanCloseTabs,
    closeAllTabsInPane,
    closeOtherTabs,
    closeTab,
    closeTabsToRight,
    leftPane,
    rightPane,
    tabs
  });

  const refreshWorkspaceAfterExternalChange = useCallback(
    async (workspaceId: string): Promise<void> => {
      const relic = window.relic;
      if (!relic) return;
      if (workspaceState?.activeWorkspace?.id && workspaceState.activeWorkspace.id !== workspaceId) return;

      const result = await relic.getWorkspaceState();
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.activeWorkspace?.id !== workspaceId) return;

      const nextFilePaths = collectMarkdownPaths(result.value.fileTree);
      const nextFilePathSet = new Set(nextFilePaths);

      for (const tabId of leftPane.tabIds) {
        const tab = tabs[tabId];
        if (tab?.kind === "file" && !nextFilePathSet.has(tab.path)) closeTab("left", tabId);
      }

      for (const tabId of rightPane.tabIds) {
        const tab = tabs[tabId];
        if (tab?.kind === "file" && !nextFilePathSet.has(tab.path)) closeTab("right", tabId);
      }

      const openFileEntries = Object.entries(tabs).reduce<Array<{ path: string; tabId: string }>>((acc, [tabId, tab]) => {
        if (tab.kind === "file" && nextFilePathSet.has(tab.path)) acc.push({ path: tab.path, tabId });
        return acc;
      }, []);
      const fileResults = await Promise.all(
        openFileEntries.map(async ({ path, tabId }) => ({
          fileResult: await relic.readMarkdownFile({ path }),
          tabId
        }))
      );

      for (const { fileResult, tabId } of fileResults) {

        if (!fileResult.ok) {
          setWorkspaceError(fileResult.error.message);
          continue;
        }

        const currentTab = useEditorStore.getState().tabs[tabId];
        if (currentTab?.kind !== "file") continue;

        const externalContent = fileResult.value.content;

        if (externalContent === currentTab.savedContent) continue;

        if (externalContent === currentTab.content) {
          markTabSaved(tabId, externalContent);
          continue;
        }

        if (currentTab.content === currentTab.savedContent) {
          updateTabFromExternal(tabId, externalContent);
          continue;
        }

        const shouldNotify = currentTab.externalConflict?.content !== externalContent;
        setTabExternalConflict(tabId, externalContent);
        if (shouldNotify) {
          setWorkspaceError(t("pane.externalConflictToast", { name: currentTab.name }));
        }
      }

      setWorkspaceState(result.value);
    },
    [
      closeTab,
      leftPane.tabIds,
      markTabSaved,
      rightPane.tabIds,
      setTabExternalConflict,
      setWorkspaceError,
      setWorkspaceState,
      tabs,
      t,
      updateTabFromExternal,
      workspaceState?.activeWorkspace?.id
    ]
  );

  useEffect(() => {
    if (!window.relic?.onWorkspaceChanged) return undefined;

    return window.relic.onWorkspaceChanged((event) => {
      void refreshWorkspaceAfterExternalChange(event.workspaceId);
    });
  }, [refreshWorkspaceAfterExternalChange]);

  useEffect(() => {
    if (!window.relic?.onWindowCloseRequested) return undefined;

    return window.relic.onWindowCloseRequested((event) => {
      void Promise.resolve(ensureCanCloseAllTabs()).then((ok) => {
        window.relic?.respondToWindowCloseRequest({ ok, requestId: event.requestId });
      });
    });
  }, [ensureCanCloseAllTabs]);

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
    openChartInPane,
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
    activeFileTabInFocusedPane,
    backlinks,
    isLoadingBacklinks,
    outlineHeadings,
    outgoingLinks,
    outgoingLinksLimited
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

  const buildFocusedPreviewOutput = useCallback(async () => {
    if (!activeFileTabInFocusedPane) return null;

    return await buildPreviewOutputHtml({
      content: activeFileTabInFocusedPane.content,
      fileName: activeFileTabInFocusedPane.name,
      path: activeFileTabInFocusedPane.path,
      t,
      title: activeFileTabInFocusedPane.name,
      workspacePath: workspaceState?.activeWorkspace?.path
    });
  }, [activeFileTabInFocusedPane, t, workspaceState?.activeWorkspace?.path]);

  const handlePrintPreview = useCallback((): void => {
    if (!window.relic) return;

    void buildFocusedPreviewOutput().then(async (payload) => {
      if (!payload) {
        setWorkspaceError("印刷するMarkdownファイルを開いてください。");
        return;
      }

      const result = await window.relic!.printPreview({ html: payload.html, title: payload.title });
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.status === "printed") showToast(t("output.printed"), "info");
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [buildFocusedPreviewOutput, setWorkspaceError, showToast, t]);

  const handleSavePreviewAsPdf = useCallback((): void => {
    if (!window.relic) return;

    void buildFocusedPreviewOutput().then(async (payload) => {
      if (!payload) {
        setWorkspaceError("PDFとして保存するMarkdownファイルを開いてください。");
        return;
      }

      const result = await window.relic!.savePreviewAsPdf(payload);
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.status === "saved") showToast(t("output.pdfSaved"), "info");
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [buildFocusedPreviewOutput, setWorkspaceError, showToast, t]);

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
    activeChartIds,
    chartRailViews,
    handleRailChartButton,
    handleRailPanelButton,
    openChartIds,
    openPanelTabIds,
    panelLabels,
    panelRailViews,
    primaryRailViews,
    renderPanelTabIcon,
    sidebarViews
  } = useAppRailNavigation({
    clearRailTabFlight,
    closeSidebar,
    featureToggles,
    focusedPane,
    leftPane,
    openChartInPane,
    openPanelInPane,
    rightPane,
    setSidebarView,
    setTabActive,
    showRailTabFlight,
    t,
    tabs
  });

  const setRailSidebarView = useCallback((view: SidebarView): void => {
    if (view === "tools" || view === "frontmatter" || view === "settings") {
      openPanelInPane(focusedPane, view, panelLabels[view]);
      setSidebarView("files");
      return;
    }

    setSidebarView(view);
  }, [focusedPane, openPanelInPane, panelLabels, setSidebarView]);

  const { renderChartTab, renderPanelTab } = useAppTabRenderers({
    appInfo,
    chronicleCalendars,
    editorSettings,
    featureToggles,
    charts,
    handleOpenFile,
    handleSaveChronicleCalendars,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleUpdateChartEntry,
    userDefinedFields,
    workspaceState
  });
  const titleBarLeftOffsetWidth = titleBarLeftOffset(
    TITLE_BAR_TRAFFIC_LIGHT_SPACE,
    RAIL_WIDTH,
    sidebarWidth
  );

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className="app-shell">
      <AppTitleBar
        canOutputPreview={Boolean(activeFileTabInFocusedPane)}
        isRightPanelOpen={isRightPanelOpen}
        isSourceMode={isSourceMode}
        isSplit={isSplit}
        leftClosingTabIds={leftClosingTabIds}
        leftOffsetWidth={titleBarLeftOffsetWidth}
        leftPane={leftPane}
        onCloseAllTabsInPane={closeAllTabsInPaneWithMotion}
        onCloseOtherTabs={closeOtherTabsWithMotion}
        onCloseTabsToRight={closeTabsToRightWithMotion}
        onDuplicateTabFile={handleDuplicateTabFile}
        onOpenInOtherPane={openFileInOtherPane}
        onPrintPreview={handlePrintPreview}
        onRevealTabFile={handleRevealTabFile}
        onRightPanelViewButton={handleRightPanelViewButton}
        onSavePreviewAsPdf={handleSavePreviewAsPdf}
        onSourceModeToggle={() => setIsSourceMode((value) => !value)}
        onSplitToggle={toggleSplitWithMotion}
        onTabClose={closeTabWithMotion}
        onTabMove={moveTab}
        onTabSelect={setTabActive}
        onTogglePinTab={toggleTabPinned}
        renderPanelTabIcon={renderPanelTabIcon}
        rightClosingTabIds={rightClosingTabIds}
        rightPane={rightPane}
        rightPanelView={rightPanelView}
        rightPanelWidth={rightPanelWidth}
        showRightPanelControls={featureToggles.rightPanel}
        tabs={tabs}
      />
      <div className="workspace">
        <AppRail
          activePanelTabIds={activePanelTabIds}
          activeSidebarView={activeSidebarView}
          activeWorkspaceId={workspaceState?.activeWorkspace?.id ?? null}
          activeChartIds={activeChartIds}
          chartRailViews={chartRailViews}
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
          onSetSidebarView={setRailSidebarView}
          onSwitchWorkspace={handleSwitchWorkspace}
          openChartIds={openChartIds}
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
          openingFilePath={openingFilePath}
          openFilePaths={openFilePathSet}
          searchError={searchError}
          searchFocusRequest={fileSearchFocusRequest}
          searchFrontmatterCandidates={frontmatterCandidates}
          searchFrontmatterField={searchFrontmatterField}
          searchFrontmatterFields={frontmatterSearchFields}
          searchLimitNotice={searchLimitNotice}
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
          leftEditorViewRef={leftEditorViewRef}
          leftPaneScrollHeading={leftPaneScrollHeading}
          onCreateFile={handleCreateNoteFromPane}
          onEditorAction={() => setEditorActionPulse((value) => value + 1)}
          onFileSaveError={setWorkspaceError}
          onFileSaved={handleFileSaved}
          onOpenFile={handleOpenFile}
          onOpenLink={handleOpenMarkdownLink}
          onOpenWikiLink={handleOpenWikiLink}
          onOutlineHeadingClick={(heading) => {
            const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;
            setScrollHeading(heading);
          }}
          onRenameFile={(path, name) => handleRenameTreeItem(path, "file", name)}
          onRightPanelResizeStart={startRightPanelResize}
          onScrollTargetHandled={(pane) => {
            if (pane === "left") {
              setLeftPaneScrollHeading(undefined);
              return;
            }

            setRightPaneScrollHeading(undefined);
          }}
          onSetFocusedPane={setFocusedPane}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          outgoingLinksLimited={outgoingLinksLimited}
          renderChartTab={renderChartTab}
          renderPanelTab={renderPanelTab}
          rightEditorViewRef={rightEditorViewRef}
          rightPaneScrollHeading={rightPaneScrollHeading}
          rightPanelView={rightPanelView}
          rightPanelWidth={rightPanelWidth}
          setLinkContextMenu={setLinkContextMenu}
          userDefinedFields={userDefinedFields}
          workspacePath={workspaceState?.activeWorkspace?.path}
        />
      </div>

      <AppStatusBar
        activeFileTab={activeFileTabInFocusedPane}
        saveStatus={activeFileTabInFocusedPane ? saveStatusByTabId[activeFileTabInFocusedPane.id] : undefined}
      />

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
