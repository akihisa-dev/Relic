import type { EditorView } from "@codemirror/view";
import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { useShallow } from "zustand/react/shallow";

import { type WorkspaceState } from "../shared/ipc";
import type { AppLinkContextMenu } from "./appLinks";
import { createAppLayoutProps } from "./appLayoutProps";
import { AppLayout } from "./components/AppLayout";
import { createTranslator } from "./i18nModel";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAppCloseGuards } from "./hooks/useAppCloseGuards";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppInlineHandlers } from "./hooks/useAppInlineHandlers";
import { useAppLayoutWidths } from "./hooks/useAppLayoutWidths";
import { useAppPaneFileActions } from "./hooks/useAppPaneFileActions";
import { useAppPreviewOutputActions } from "./hooks/useAppPreviewOutputActions";
import { useAppRailNavigation } from "./hooks/useAppRailNavigation";
import { useAppRailSidebarSelection } from "./hooks/useAppRailSidebarSelection";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTabRenderers } from "./hooks/useAppTabRenderers";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppToast } from "./hooks/useAppToast";
import { useAppWorkspaceCollections } from "./hooks/useAppWorkspaceCollections";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { useEditorAutoSave } from "./hooks/useEditorAutoSave";
import type { HeadingScrollTarget } from "./editorDerivedState";
import { usePaneTabMotion } from "./hooks/usePaneTabMotion";
import { useRailFlights } from "./hooks/useRailFlights";
import { useSidebarFileInteractions } from "./hooks/useSidebarFileInteractions";
import { useSplitCloseMotion } from "./hooks/useSplitCloseMotion";
import { useWindowCloseRequest } from "./hooks/useWindowCloseRequest";
import { useWorkspaceAliases } from "./hooks/useWorkspaceAliases";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceChronicleCalendars } from "./hooks/useWorkspaceChronicleCalendars";
import { useWorkspaceCharts } from "./hooks/useWorkspaceCharts";
import { useWorkspaceExternalRefresh } from "./hooks/useWorkspaceExternalRefresh";
import { useWorkspaceRenameRailHold } from "./hooks/useWorkspaceRenameRailHold";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore } from "./store/editorStore";
import { useUiStore, type RightPanelView } from "./store/uiStore";
import "./styles.css";

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<AppLinkContextMenu | null>(null);
  const { closeToast, isToastClosing, setWorkspaceError, showToast, toastMessage } = useAppToast();
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<HeadingScrollTarget | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<HeadingScrollTarget | undefined>(undefined);
  const [editorActionPulse, setEditorActionPulse] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const {
    clearRailTabFlight,
    railTabFlight,
    showSidebarCreateFlight,
    sidebarCreateFlight
  } = useRailFlights();
  const [fileSearchFocusRequest, setFileSearchFocusRequest] = useState(0);
  const [fileSelectionCount, setFileSelectionCount] = useState(0);
  const [isLeftSourceMode, setIsLeftSourceMode] = useState(false);
  const [isRightSourceMode, setIsRightSourceMode] = useState(false);
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
    openImageInPane,
    openPdfInPane,
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
  } = useEditorStore(useShallow((state) => ({
    closeAllTabs: state.closeAllTabs,
    closeAllTabsInPane: state.closeAllTabsInPane,
    closeOtherTabs: state.closeOtherTabs,
    closeTab: state.closeTab,
    closeTabsToRight: state.closeTabsToRight,
    editorSettings: state.editorSettings,
    focusedPane: state.focusedPane,
    isSplit: state.isSplit,
    leftPane: state.leftPane,
    markTabSaved: state.markTabSaved,
    moveTab: state.moveTab,
    openChartInPane: state.openChartInPane,
    openFileInPane: state.openFileInPane,
    openImageInPane: state.openImageInPane,
    openPdfInPane: state.openPdfInPane,
    openPanelInPane: state.openPanelInPane,
    rightPane: state.rightPane,
    setEditorSettings: state.setEditorSettings,
    setFocusedPane: state.setFocusedPane,
    setTabActive: state.setTabActive,
    setTabExternalConflict: state.setTabExternalConflict,
    tabs: state.tabs,
    toggleSplit: state.toggleSplit,
    toggleTabPinned: state.toggleTabPinned,
    updateTabContent: state.updateTabContent,
    updateTabFromExternal: state.updateTabFromExternal,
    updateTabMeta: state.updateTabMeta
  })));

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
  } = useUiStore(useShallow((state) => ({
    activeSidebarView: state.activeSidebarView,
    closeSidebar: state.closeSidebar,
    isRightPanelOpen: state.isRightPanelOpen,
    isSidebarOpen: state.isSidebarOpen,
    isTypewriterMode: state.isTypewriterMode,
    rightPanelView: state.rightPanelView,
    setRightPanelView: state.setRightPanelView,
    setSidebarView: state.setSidebarView,
    toggleRightPanel: state.toggleRightPanel,
    toggleSidebar: state.toggleSidebar,
    toggleTypewriterMode: state.toggleTypewriterMode
  })));
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
  const handleLargeMarkdownFallback = useCallback((name: string) => {
    showToast(t("pane.largeMarkdownToast", { name }), "info");
  }, [showToast, t]);
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
  const isRightPanelOutlineAvailable = featureToggles.rightPanelOutline;
  const isRightPanelLinksAvailable = featureToggles.rightPanelLinks;
  const isRightPanelFrontmatterAvailable = featureToggles.frontmatter;
  const isRightPanelRecoveryAvailable = true;
  const isRightPanelAvailable = isRightPanelOutlineAvailable || isRightPanelLinksAvailable || isRightPanelFrontmatterAvailable || isRightPanelRecoveryAvailable;
  const effectiveRightPanelView = resolveEnabledRightPanelView(
    rightPanelView,
    isRightPanelOutlineAvailable,
    isRightPanelLinksAvailable,
    isRightPanelFrontmatterAvailable,
    isRightPanelRecoveryAvailable
  );
  const isEffectiveRightPanelOpen = isRightPanelAvailable && isRightPanelOpen;
  const isLinksPanelActive = isEffectiveRightPanelOpen &&
    isRightPanelLinksAvailable &&
    effectiveRightPanelView === "links";
  const toggleRightPanelIfAvailable = useCallback((): void => {
    if (!isRightPanelAvailable) return;
    if (!isRightPanelOpen && rightPanelView !== effectiveRightPanelView) {
      setRightPanelView(effectiveRightPanelView);
      return;
    }
    toggleRightPanel();
  }, [effectiveRightPanelView, isRightPanelAvailable, isRightPanelOpen, rightPanelView, setRightPanelView, toggleRightPanel]);

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

  const {
    existingMarkdownPaths,
    openFilePathSet,
    registeredWorkspaces
  } = useAppWorkspaceCollections({ tabs, workspaceState });
  const aliasesByPath = useWorkspaceAliases({ setWorkspaceError, workspaceState });
  const { charts, handleUpdateChartEntry, reloadCharts } = useWorkspaceCharts({
    hasOpenChart,
    setWorkspaceError,
    tabs,
    updateTabContent,
    workspaceState
  });
  const { chronicleCalendars, handleSaveChronicleCalendars } = useWorkspaceChronicleCalendars({
    onSaved: () => {
      if (hasOpenChart) void reloadCharts();
    },
    setWorkspaceError,
    workspaceState
  });
  const frontmatterCandidatesWithChronicle = useMemo(() => ({
    ...frontmatterCandidates,
    chronicle: chronicleCalendars.map((calendar) => calendar.name)
  }), [chronicleCalendars, frontmatterCandidates]);

  const handleFileSaved = useCallback((path?: string): void => {
    if (hasOpenChart) void reloadCharts();
    if (!path || !window.relic) return;

    void window.relic.getWorkspaceState().then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        return;
      }

      setWorkspaceError(result.error.message);
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [hasOpenChart, reloadCharts, setWorkspaceError, setWorkspaceState]);

  const { flushTabsBeforeClose, saveStatusByTabId } = useEditorAutoSave({
    conflictCloseBlockedMessage: t("pane.externalConflictCloseBlocked"),
    onSaved: handleFileSaved,
    onSaveError: setWorkspaceError,
    saveFailedMessage: t("pane.saveFailed"),
    tabs
  });
  const {
    ensureCanCloseAllTabs,
    ensureCanCloseTabs,
    ensureCanMutateWorkspaceItems
  } = useAppCloseGuards({
    focusedPane,
    flushTabsBeforeClose,
    saveFailedMessage: t("pane.saveFailed"),
    setWorkspaceError
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
    handleRevealWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleImportMarkdownFiles,
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
    openImageInPane,
    openPdfInPane,
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
  const appInlineHandlers = useAppInlineHandlers({
    focusedPane,
    setEditorActionPulse,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading
  });

  const {
    handleCreateFileFromSidebar,
    handleCreateFolderFromSidebar,
    handleSidebarOpenFile,
    openingFilePath
  } = useSidebarFileInteractions({
    handleCreateFile,
    handleCreateFolder,
    handleOpenFile,
    onFileOpenMotion: appInlineHandlers.onFileOpenMotion,
    openFileInPane,
    openImageInPane,
    openPdfInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setTabActive,
    setWorkspaceError,
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

  useWorkspaceExternalRefresh({
    closeTab,
    leftPane,
    markTabSaved,
    rightPane,
    setTabExternalConflict,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs,
    updateTabFromExternal,
    workspaceState
  });
  useWindowCloseRequest(ensureCanCloseAllTabs);

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
    toggleRightPanel: toggleRightPanelIfAvailable,
    toggleSidebar,
    toggleSplit: toggleSplitWithMotion,
    toggleTypewriterMode
  });

  const {
    isRightPanelResizing,
    isSidebarResizing,
    rightPanelWidth,
    sidebarWidth,
    startRightPanelResize,
    startSidebarResize
  } = useAppLayoutWidths();

  const leftEditorViewRef = useRef<EditorView | null>(null);
  const rightEditorViewRef = useRef<EditorView | null>(null);

  const handleRightPanelViewButton = useCallback((view: RightPanelView): void => {
    if (view === "outline" && !isRightPanelOutlineAvailable) return;
    if (view === "links" && !isRightPanelLinksAvailable) return;
    if (view === "frontmatter" && !isRightPanelFrontmatterAvailable) return;
    if (view === "recovery" && !isRightPanelRecoveryAvailable) return;

    if (isEffectiveRightPanelOpen && effectiveRightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [
    effectiveRightPanelView,
    isEffectiveRightPanelOpen,
    isRightPanelFrontmatterAvailable,
    isRightPanelLinksAvailable,
    isRightPanelOutlineAvailable,
    isRightPanelRecoveryAvailable,
    setRightPanelView,
    toggleRightPanel
  ]);

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
    openImageInPane,
    openPdfInPane,
    openChartInPane,
    openPanelInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    t,
    tabs
  });

  const {
    activeFileTabInFocusedPane,
    applyingReferenceKey,
    backlinks,
    isLoadingBacklinks,
    isLoadingUnlinkedReferences,
    onApplyUnlinkedReference,
    outlineHeadings,
    outgoingLinks,
    outgoingLinksLimited,
    unlinkedReferences
  } = useActiveDocumentContext({
    aliasesByPath,
    existingMarkdownPaths,
    fileTree: workspaceState?.fileTree,
    focusedPane,
    isLinksPanelActive,
    leftPane,
    rightPane,
    setWorkspaceError,
    tabs,
    updateTabContent
  });

  const { handleSavePreviewAsPdf } = useAppPreviewOutputActions({
    activeFileTab: activeFileTabInFocusedPane,
    setWorkspaceError,
    showToast,
    t,
    workspacePath: workspaceState?.activeWorkspace?.path
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
    toggleRightPanel: toggleRightPanelIfAvailable,
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
    setTabActive,
    t,
    tabs
  });

  const setRailSidebarView = useAppRailSidebarSelection({
    focusedPane,
    openPanelInPane,
    panelLabels,
    setSidebarView
  });

  const handleOpenGraphTagSearch = useCallback((tag: string): void => {
    setSearchMode("tag");
    setSearchQuery(tag);
    setSidebarView("files");
    setFileSearchFocusRequest((current) => current + 1);
  }, [setSearchMode, setSearchQuery, setSidebarView]);

  const { renderChartTab, renderPanelTab } = useAppTabRenderers({
    appInfo,
    chronicleCalendars,
    editorSettings,
    featureToggles,
    charts,
    handleOpenFile,
    handleOpenTagSearch: handleOpenGraphTagSearch,
    handleSaveChronicleCalendars,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleUpdateChartEntry,
    userDefinedFields,
    workspaceState
  });
  const appLayoutProps = createAppLayoutProps({
    editorWorkspace: {
      activeFileTab: activeFileTabInFocusedPane,
      allFilePaths: existingMarkdownPaths,
      appInlineHandlers,
      applyingReferenceKey,
      backlinks,
      closeAllTabsInPaneWithMotion,
      closeOtherTabsWithMotion,
      closeTabWithMotion,
      closeTabsToRightWithMotion,
      editorActionPulse,
      editorSettings,
      focusedPane,
      frontmatterCandidates: frontmatterCandidatesWithChronicle,
      handleCreateNoteFromPane,
      handleDuplicateTabFile,
      handleFileSaved,
      handleLargeMarkdownFallback,
      handleOpenFile,
      handleOpenMarkdownLink,
      handleOpenWikiLink,
      handleRenameTreeItem,
      handleRevealTabFile,
      handleRightPanelViewButton,
      handleSavePreviewAsPdf,
      isEffectiveRightPanelOpen,
      isLoadingBacklinks,
      isLoadingUnlinkedReferences,
      isRightPanelResizing,
      isLeftSourceMode,
      isRightSourceMode,
      isSplit,
      isSplitClosing,
      isTypewriterMode,
      leftClosingTabIds,
      leftEditorViewRef,
      leftPaneScrollHeading,
      moveTab,
      openFileInOtherPane,
      onApplyUnlinkedReference,
      outlineHeadings,
      outgoingLinks,
      outgoingLinksLimited,
      renderChartTab,
      renderPanelTab,
      renderPanelTabIcon,
      rightClosingTabIds,
      rightEditorViewRef,
      rightPaneScrollHeading,
      rightPanelView: effectiveRightPanelView,
      rightPanelWidth,
      setFocusedPane,
      setIsLeftSourceMode,
      setIsRightSourceMode,
      setLinkContextMenu,
      setTabActive,
      setWorkspaceError,
      showRightPanelLinksControl: isRightPanelLinksAvailable,
      showRightPanelOutlineControl: isRightPanelOutlineAvailable,
      showRightPanelFrontmatterControl: isRightPanelFrontmatterAvailable,
      showRightPanelRecoveryControl: isRightPanelRecoveryAvailable,
      startRightPanelResize,
      toggleSplitWithMotion,
      toggleTabPinned,
      updateTabContent,
      unlinkedReferences,
      userDefinedFields,
      workspaceState
    },
    filesSidebar: {
      activeSidebarView,
      closeSidebar,
      fileSearchFocusRequest,
      fileSelectionCount,
      frontmatterCandidates,
      frontmatterSearchFields,
      handleCreateFileFromSidebar,
      handleCreateFileInFolder,
      handleCreateFolderFromSidebar,
      handleCreateFolderInFolder,
      handleCreateNewWorkspace,
      handleDeleteTreeItem,
      handleDeleteTreeItems,
      handleDuplicateTreeFile,
      handleImportMarkdownFiles,
      handleMoveFile,
      handleMoveFolder,
      handleMoveTreeItems,
      handleOpenWorkspace,
      handleRenameTreeItem,
      handleRevealWorkspaceItem,
      handleSelectFolder,
      handleSidebarOpenFile,
      handleTogglePin,
      isCreatingFile,
      isCreatingFolder,
      isCreatingWorkspace,
      isOpeningWorkspace,
      isSearching,
      isSidebarOpen,
      isSidebarResizing,
      isSplit,
      openFilePathSet,
      openingFilePath,
      openTreeFileInOtherPane,
      searchError,
      searchFrontmatterField,
      searchLimitNotice,
      searchMode,
      searchQuery,
      searchResults,
      setFileSelectionCount,
      setSearchFrontmatterField,
      setSearchMode,
      setSearchQuery,
      sidebarViews,
      sidebarWidth,
      startSidebarResize,
      t,
      workspaceState
    },
    overlays: {
      aliasesByPath,
      closeToast,
      commands,
      existingMarkdownPaths,
      handleOpenFile,
      handleOpenWikiLink,
      handleRevealWorkspaceItem,
      isSplit,
      isToastClosing,
      linkContextMenu,
      openWorkspacePathInOtherPane,
      railTabFlight,
      setLinkContextMenu,
      setShowCommandPalette,
      setShowQuickSwitcher,
      showCommandPalette,
      showQuickSwitcher,
      sidebarCreateFlight,
      toastMessage
    },
    rail: {
      activeChartIds,
      activePanelTabIds,
      activeSidebarView,
      chartRailViews,
      closeSidebar,
      handleRailChartButton,
      handleRailPanelButton,
      handleRemoveWorkspace,
      handleRenameWorkspace,
      handleRevealWorkspace,
      handleSwitchWorkspace,
      holdWorkspaceRailAfterRename,
      isSidebarOpen,
      isWorkspaceRenameActive,
      isWorkspaceRenameHoldingRail,
      openChartIds,
      openPanelTabIds,
      panelRailViews,
      primaryRailViews,
      registeredWorkspaces,
      setIsWorkspaceRenameActive,
      setRailSidebarView,
      t,
      workspaceState
    },
    shell: {
      editorSettings
    },
    statusBar: {
      activeFileTab: activeFileTabInFocusedPane,
      saveStatusByTabId
    }
  });

  return <AppLayout {...appLayoutProps} />;
}

function resolveEnabledRightPanelView(
  currentView: RightPanelView,
  isOutlineAvailable: boolean,
  isLinksAvailable: boolean,
  isFrontmatterAvailable: boolean,
  isRecoveryAvailable: boolean
): RightPanelView {
  if (currentView === "outline" && isOutlineAvailable) return "outline";
  if (currentView === "links" && isLinksAvailable) return "links";
  if (currentView === "frontmatter" && isFrontmatterAvailable) return "frontmatter";
  if (currentView === "recovery" && isRecoveryAvailable) return "recovery";
  if (isOutlineAvailable) return "outline";
  if (isLinksAvailable) return "links";
  if (isFrontmatterAvailable) return "frontmatter";
  if (isRecoveryAvailable) return "recovery";
  return "links";
}
