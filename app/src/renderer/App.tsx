import { useCallback, useMemo, useState, type ReactElement } from "react";
import { useShallow } from "zustand/react/shallow";

import { type ApplicationMenuState, type WorkspaceState } from "../shared/ipc";
import type { AppCommandActions } from "./appCommandActions";
import { createAppLayoutProps } from "./appLayoutProps";
import { selectAppEditorStoreState, selectAppUiStoreState } from "./appStoreSelectors";
import { AppLayout } from "./components/AppLayout";
import { createTranslator } from "./i18nModel";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAppCloseGuards } from "./hooks/useAppCloseGuards";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useApplicationMenu } from "./hooks/useApplicationMenu";
import { useAppInlineHandlers } from "./hooks/useAppInlineHandlers";
import { useAppFileSaved } from "./hooks/useAppFileSaved";
import { useAppLayoutWidths } from "./hooks/useAppLayoutWidths";
import { useAppOverlayState } from "./hooks/useAppOverlayState";
import { useAppPanePresentationState } from "./hooks/useAppPanePresentationState";
import { useAppPaneFileActions } from "./hooks/useAppPaneFileActions";
import { useAppPreviewOutputActions } from "./hooks/useAppPreviewOutputActions";
import { useAppRailNavigation } from "./hooks/useAppRailNavigation";
import { useAppRailSidebarSelection } from "./hooks/useAppRailSidebarSelection";
import { useAppRightPanel } from "./hooks/useAppRightPanel";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTabRenderers } from "./hooks/useAppTabRenderers";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppToast } from "./hooks/useAppToast";
import { useAppWorkspaceDerivedData } from "./hooks/useAppWorkspaceDerivedData";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { useEditorAutoSave } from "./hooks/useEditorAutoSave";
import { usePaneTabMotion } from "./hooks/usePaneTabMotion";
import { useRailFlights } from "./hooks/useRailFlights";
import { useSidebarFileInteractions } from "./hooks/useSidebarFileInteractions";
import { useSplitCloseMotion } from "./hooks/useSplitCloseMotion";
import { useWindowCloseRequest } from "./hooks/useWindowCloseRequest";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceExternalRefresh } from "./hooks/useWorkspaceExternalRefresh";
import { useWorkspaceRenameRailHold } from "./hooks/useWorkspaceRenameRailHold";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";
import "./styles.css";

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const { closeToast, isToastClosing, setWorkspaceError, showToast, toastMessage } = useAppToast();
  const {
    linkContextMenu,
    openQuickSwitcher,
    setLinkContextMenu,
    setShowCommandPalette,
    setShowQuickSwitcher,
    showCommandPalette,
    showQuickSwitcher
  } = useAppOverlayState();
  const {
    editorActionPulse,
    isLeftSourceMode,
    isRightSourceMode,
    leftEditorViewRef,
    leftPaneScrollHeading,
    rightEditorViewRef,
    rightPaneScrollHeading,
    setEditorActionPulse,
    setIsLeftSourceMode,
    setIsRightSourceMode,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading
  } = useAppPanePresentationState();
  const [workspaceDataRevision, setWorkspaceDataRevision] = useState(0);
  const {
    clearRailTabFlight,
    railTabFlight,
    showSidebarCreateFlight,
    sidebarCreateFlight
  } = useRailFlights();
  const [fileSelectionCount, setFileSelectionCount] = useState(0);
  const {
    holdWorkspaceRailAfterRename,
    isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail,
    setIsWorkspaceRenameActive
  } = useWorkspaceRenameRailHold();

  const {
    canNavigateBack,
    canNavigateForward,
    canReopenClosedTab,
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
    navigateBack,
    navigateForward,
    openFileInPane,
    openImageInPane,
    openPdfInPane,
    openChartInPane,
    openPanelInPane,
    reopenClosedTab,
    setEditorSettings,
    setFocusedPane,
    setTabActive,
    toggleTabPinned,
    toggleSplit,
    updateTabContent,
    updateTabMeta
  } = useEditorStore(useShallow(selectAppEditorStoreState));

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
  } = useUiStore(useShallow(selectAppUiStoreState));
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
  const removeWorkspaceLabel = useCallback(
    (name: string) => t("files.removeWorkspace", { name }),
    [t]
  );
  const handleLargeMarkdownFallback = useCallback((name: string) => {
    showToast(t("pane.largeMarkdownToast", { name }), "info");
  }, [showToast, t]);
  const {
    appInfo,
    featureToggles,
    handleSaveFeatureToggles,
    handleSaveSettings,
    userDefinedFields
  } = useAppSettingsState({
    setEditorSettings,
    setWorkspaceError,
    setWorkspaceState
  });
  const isRightPanelOutlineAvailable = true;
  const isRightPanelLinksAvailable = true;
  const isRightPanelRecoveryAvailable = true;
  const {
    effectiveRightPanelView,
    handleRightPanelViewButton,
    isEffectiveRightPanelOpen,
    isLinksPanelActive,
    toggleRightPanelIfAvailable
  } = useAppRightPanel({
    isLinksAvailable: isRightPanelLinksAvailable,
    isOutlineAvailable: isRightPanelOutlineAvailable,
    isRecoveryAvailable: isRightPanelRecoveryAvailable,
    isRightPanelOpen,
    rightPanelView,
    setRightPanelView,
    toggleRightPanel
  });

  const {
    frontmatterCandidates,
    isSearching,
    searchError,
    searchFrontmatterField,
    searchLimitNotice,
    searchMode,
    searchQuery,
    searchResults,
    setSearchMode,
    setSearchQuery
  } = useWorkspaceSearchState({
    setWorkspaceError,
    userDefinedFields,
    workspaceState
  });

  const {
    aliasesByPath,
    calendarSettings,
    categoryChoices,
    charts,
    existingMarkdownPaths,
    frontmatterCandidatesWithCategory,
    handleSaveCalendarSettings,
    handleSaveCategoryChoices,
    openFilePathSet,
    registeredWorkspaces,
    reloadCharts
  } = useAppWorkspaceDerivedData({
    frontmatterCandidates,
    hasOpenChart,
    setWorkspaceError,
    tabs,
    workspaceState
  });

  const handleFileSaved = useAppFileSaved({
    hasOpenChart,
    reloadCharts,
    setWorkspaceError,
    setWorkspaceState
  });

  const { flushTabsBeforeClose, saveStatusByTabId } = useEditorAutoSave({
    conflictCloseBlockedMessage: t("pane.externalConflictCloseBlocked"),
    onSaved: handleFileSaved,
    onSaveError: setWorkspaceError,
    saveFailedMessage: t("pane.saveFailed")
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

  const handleWorkspaceDataChanged = useCallback(async (): Promise<boolean> => {
    setWorkspaceDataRevision((revision) => revision + 1);
    return hasOpenChart ? reloadCharts() : true;
  }, [hasOpenChart, reloadCharts]);
  const { isRefreshingWorkspace, refreshWorkspace } = useWorkspaceExternalRefresh({
    flushTabsBeforeClose,
    onWorkspaceDataChanged: handleWorkspaceDataChanged,
    setWorkspaceError,
    setWorkspaceState,
    showToast,
    t,
    workspaceState
  });
  useWindowCloseRequest(ensureCanCloseAllTabs);
  const isDarkTheme = useAppTheme(editorSettings.theme);
  const appCommandActions = useMemo<AppCommandActions>(() => ({
    "close-tab": () => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      if (paneState.activeTabId) closeTabWithMotion(focusedPane, paneState.activeTabId);
    },
    "new-note": () => {
      setSidebarView("files");
      setIsCreatingFile(true);
    },
    "open-command-palette": () => {
      setShowQuickSwitcher(false);
      setShowCommandPalette((current) => !current);
    },
    "open-quick-switcher": () => {
      setShowCommandPalette(false);
      setShowQuickSwitcher((current) => !current);
    },
    "open-search": openQuickSwitcher,
    "open-settings": () => setSidebarView("settings"),
    "reopen-closed-tab": reopenClosedTab,
    "toggle-right-panel": toggleRightPanelIfAvailable,
    "toggle-sidebar": toggleSidebar,
    "toggle-split": toggleSplitWithMotion,
    "toggle-typewriter": toggleTypewriterMode
  }), [
    closeTabWithMotion,
    focusedPane,
    leftPane,
    openQuickSwitcher,
    reopenClosedTab,
    rightPane,
    setIsCreatingFile,
    setShowCommandPalette,
    setShowQuickSwitcher,
    setSidebarView,
    toggleRightPanelIfAvailable,
    toggleSidebar,
    toggleSplitWithMotion,
    toggleTypewriterMode
  ]);
  const applicationMenuState = useMemo<ApplicationMenuState>(() => ({
    canCloseTab: Boolean((focusedPane === "left" ? leftPane : rightPane).activeTabId),
    canReopenClosedTab,
    canToggleRightPanel: true,
    isRightPanelOpen: isEffectiveRightPanelOpen,
    isSidebarOpen,
    isSplit,
    isTypewriterMode
  }), [
    canReopenClosedTab,
    focusedPane,
    isEffectiveRightPanelOpen,
    isSidebarOpen,
    isSplit,
    isTypewriterMode,
    leftPane,
    rightPane
  ]);
  useApplicationMenu({ actions: appCommandActions, state: applicationMenuState });
  useAppKeyboardShortcuts({ actions: appCommandActions });

  const {
    isRightPanelResizing,
    isSidebarResizing,
    rightPanelWidth,
    sidebarWidth,
    startRightPanelResize,
    startSidebarResize
  } = useAppLayoutWidths();

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
    isRightPanelOpen: isEffectiveRightPanelOpen,
    rightPanelView: effectiveRightPanelView,
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
    workspacePath: workspaceState?.activeWorkspace?.path,
    workspaceRevision: workspaceDataRevision
  });
  const commands = useCommandPaletteCommands({
    activeFileName: activeFileTabInFocusedPane?.name ?? null,
    appCommandActions,
    canReopenClosedTab,
    handleDeleteActiveFile,
    handleDuplicateActiveFile,
    setSidebarView,
    t
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
  }, [setSearchMode, setSearchQuery, setSidebarView]);

  const { renderChartTab, renderPanelTab } = useAppTabRenderers({
    appInfo,
    categoryChoices,
    calendarSettings,
    editorSettings,
    featureToggles,
    charts,
    currentFilePath: activeFileTabInFocusedPane?.path ?? null,
    handleOpenFile,
    handleOpenTagSearch: handleOpenGraphTagSearch,
    handleSaveCategoryChoices,
    handleSaveCalendarSettings,
    handleSaveFeatureToggles,
    handleSaveSettings,
    workspaceDataRevision,
    workspaceState
  });
  const appLayoutProps = createAppLayoutProps({
    editorWorkspace: {
      activeFileTab: activeFileTabInFocusedPane,
      allFilePaths: existingMarkdownPaths,
      appInlineHandlers,
      applyingReferenceKey,
      backlinks,
      canReopenClosedTab,
      closeAllTabsInPaneWithMotion,
      closeOtherTabsWithMotion,
      closeTabWithMotion,
      closeTabsToRightWithMotion,
      editorActionPulse,
      editorSettings,
      focusedPane,
      frontmatterCandidates: frontmatterCandidatesWithCategory,
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
      reopenClosedTab,
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
      showRightPanelRecoveryControl: isRightPanelRecoveryAvailable,
      startRightPanelResize,
      toggleSplitWithMotion,
      toggleTabPinned,
      updateTabContent,
      unlinkedReferences,
      userDefinedFields,
      workspaceDataRevision,
      workspaceState
    },
    filesSidebar: {
      activeSidebarView,
      closeSidebar,
      fileSelectionCount,
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
      handleOpenQuickSwitcher: openQuickSwitcher,
      handleOpenWorkspace,
      handleRenameTreeItem,
      handleRevealWorkspaceItem,
      handleSelectFolder,
      handleSidebarOpenFile,
      showToast,
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
      isRefreshingWorkspace,
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
      removeWorkspaceLabel,
      refreshWorkspace,
      setIsWorkspaceRenameActive,
      setRailSidebarView,
      t,
      workspaceState
    },
    shell: {
      canNavigateBack,
      canNavigateForward,
      editorSettings,
      handleSaveSettings,
      isDarkTheme,
      navigateBack,
      navigateForward
    },
    statusBar: {
      activeFileTab: activeFileTabInFocusedPane,
      language: editorSettings.language,
      onLanguageChange: (language) => handleSaveSettings({ ...editorSettings, language }),
      saveStatusByTabId
    }
  });

  return <AppLayout {...appLayoutProps} />;
}
