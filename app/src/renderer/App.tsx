import { relicClient } from "./relicClient";
import type { EditorView } from "@codemirror/view";
import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { useShallow } from "zustand/react/shallow";

import { type WorkspaceState } from "../shared/ipc";
import type { AppLinkContextMenu } from "./appLinks";
import { createAppLayoutProps } from "./appLayoutProps";
import { selectAppEditorStoreState, selectAppUiStoreState } from "./appStoreSelectors";
import { AppLayout } from "./components/AppLayout";
import { createTranslator } from "./i18nModel";
import { isMacPlatform } from "./keyboardShortcuts";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAppCloseGuards } from "./hooks/useAppCloseGuards";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppInlineHandlers } from "./hooks/useAppInlineHandlers";
import { useAppLayoutWidths } from "./hooks/useAppLayoutWidths";
import { useAppPaneFileActions } from "./hooks/useAppPaneFileActions";
import { useAppPreviewOutputActions } from "./hooks/useAppPreviewOutputActions";
import { useAppRailNavigation } from "./hooks/useAppRailNavigation";
import { useAppRailSidebarSelection } from "./hooks/useAppRailSidebarSelection";
import { useAppRightPanel } from "./hooks/useAppRightPanel";
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
import { useWorkspaceFrontmatterCategoryChoices } from "./hooks/useWorkspaceFrontmatterCategoryChoices";
import { useWorkspaceCharts } from "./hooks/useWorkspaceCharts";
import { useWorkspaceExternalRefresh } from "./hooks/useWorkspaceExternalRefresh";
import { useWorkspaceRenameRailHold } from "./hooks/useWorkspaceRenameRailHold";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";
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
  const isRightPanelOutlineAvailable = featureToggles.rightPanelOutline;
  const isRightPanelLinksAvailable = featureToggles.rightPanelLinks;
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

  const handleOpenQuickSwitcher = useCallback((): void => {
    setShowCommandPalette(false);
    setShowQuickSwitcher(true);
  }, []);

  const {
    existingMarkdownPaths,
    openFilePathSet,
    registeredWorkspaces
  } = useAppWorkspaceCollections({ tabs, workspaceState });
  const aliasesByPath = useWorkspaceAliases({ setWorkspaceError, workspaceState });
  const { charts, reloadCharts } = useWorkspaceCharts({
    hasOpenChart,
    setWorkspaceError,
    workspaceState
  });
  const { categoryChoices, handleSaveCategoryChoices } = useWorkspaceFrontmatterCategoryChoices({
    setWorkspaceError,
    workspaceState
  });
  const frontmatterCandidatesWithCategory = useMemo(() => ({
    ...frontmatterCandidates,
    category: categoryChoices
  }), [categoryChoices, frontmatterCandidates]);

  const handleFileSaved = useCallback((path?: string): void => {
    if (hasOpenChart) void reloadCharts();
    if (!path || !relicClient.current) return;

    void relicClient.current.getWorkspaceState().then((result) => {
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

  const isDarkTheme = useAppTheme(editorSettings.theme);

  useAppKeyboardShortcuts({
    closeTab: closeTabWithMotion,
    focusedPane,
    leftPane,
    requestFileSearchFocus: handleOpenQuickSwitcher,
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
    workspacePath: workspaceState?.activeWorkspace?.path
  });
  const commands = useCommandPaletteCommands({
    activeFileName: activeFileTabInFocusedPane?.name ?? null,
    handleDeleteActiveFile,
    handleDuplicateActiveFile,
    requestFileSearchFocus: handleOpenQuickSwitcher,
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
  }, [setSearchMode, setSearchQuery, setSidebarView]);

  const { renderChartTab, renderPanelTab } = useAppTabRenderers({
    appInfo,
    categoryChoices,
    editorSettings,
    featureToggles,
    charts,
    handleOpenFile,
    handleOpenTagSearch: handleOpenGraphTagSearch,
    handleSaveCategoryChoices,
    handleSaveFeatureToggles,
    handleSaveSettings,
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
      handleOpenQuickSwitcher,
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
      removeWorkspaceLabel,
      setIsWorkspaceRenameActive,
      setRailSidebarView,
      t,
      workspaceState
    },
    shell: {
      editorSettings,
      handleSaveSettings,
      isDarkTheme,
      showThemeSwitch: isMacPlatform()
    },
    statusBar: {
      activeFileTab: activeFileTabInFocusedPane,
      saveStatusByTabId
    }
  });

  return <AppLayout {...appLayoutProps} />;
}
