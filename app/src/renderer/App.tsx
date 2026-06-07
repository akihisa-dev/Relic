import type { EditorView } from "@codemirror/view";
import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";

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
  const isRightPanelAvailable = isRightPanelOutlineAvailable || isRightPanelLinksAvailable;
  const effectiveRightPanelView = resolveEnabledRightPanelView(
    rightPanelView,
    isRightPanelOutlineAvailable,
    isRightPanelLinksAvailable
  );
  const isEffectiveRightPanelOpen = isRightPanelAvailable && isRightPanelOpen;
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

    if (isEffectiveRightPanelOpen && effectiveRightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [
    effectiveRightPanelView,
    isEffectiveRightPanelOpen,
    isRightPanelLinksAvailable,
    isRightPanelOutlineAvailable,
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

  const { handlePrintPreview, handleSavePreviewAsPdf } = useAppPreviewOutputActions({
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
  const appLayoutProps = createAppLayoutProps({
    activeChartIds,
    activeFileTabInFocusedPane,
    activePanelTabIds,
    activeSidebarView,
    aliasesByPath,
    appInlineHandlers,
    backlinks,
    chartRailViews,
    closeAllTabsInPaneWithMotion,
    closeOtherTabsWithMotion,
    closeSidebar,
    closeTabWithMotion,
    closeTabsToRightWithMotion,
    closeToast,
    commands,
    editorActionPulse,
    editorSettings,
    existingMarkdownPaths,
    featureRightPanelLinksAvailable: isRightPanelLinksAvailable,
    featureRightPanelOutlineAvailable: isRightPanelOutlineAvailable,
    fileSearchFocusRequest,
    fileSelectionCount,
    focusedPane,
    frontmatterCandidates,
    frontmatterSearchFields,
    handleCreateFileFromSidebar,
    handleCreateFileInFolder,
    handleCreateFolderFromSidebar,
    handleCreateFolderInFolder,
    handleCreateNewWorkspace,
    handleCreateNoteFromPane,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateTabFile,
    handleDuplicateTreeFile,
    handleFileSaved,
    handleLargeMarkdownFallback,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleOpenFile,
    handleOpenMarkdownLink,
    handleOpenWikiLink,
    handleOpenWorkspace,
    handlePrintPreview,
    handleRailChartButton,
    handleRailPanelButton,
    handleRemoveWorkspace,
    handleRenameTreeItem,
    handleRenameWorkspace,
    handleRevealWorkspace,
    handleRevealTabFile,
    handleRevealWorkspaceItem,
    handleRightPanelViewButton,
    handleSavePreviewAsPdf,
    handleSelectFolder,
    handleSidebarOpenFile,
    handleSwitchWorkspace,
    handleTogglePin,
    holdWorkspaceRailAfterRename,
    isCreatingFile,
    isCreatingFolder,
    isCreatingWorkspace,
    isEffectiveRightPanelOpen,
    isLoadingBacklinks,
    isOpeningWorkspace,
    isRightPanelResizing,
    isSearching,
    isSidebarOpen,
    isSidebarResizing,
    isLeftSourceMode,
    isRightSourceMode,
    isSplit,
    isSplitClosing,
    isToastClosing,
    isTypewriterMode,
    isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail,
    leftClosingTabIds,
    leftEditorViewRef,
    leftPaneScrollHeading,
    linkContextMenu,
    moveTab,
    openChartIds,
    openFileInOtherPane,
    openFilePathSet,
    openPanelTabIds,
    openTreeFileInOtherPane,
    openWorkspacePathInOtherPane,
    openingFilePath,
    outlineHeadings,
    outgoingLinks,
    outgoingLinksLimited,
    panelRailViews,
    primaryRailViews,
    railTabFlight,
    registeredWorkspaces,
    renderChartTab,
    renderPanelTab,
    renderPanelTabIcon,
    rightClosingTabIds,
    rightEditorViewRef,
    rightPaneScrollHeading,
    rightPanelView: effectiveRightPanelView,
    rightPanelWidth,
    saveStatusByTabId,
    searchError,
    searchFrontmatterField,
    searchLimitNotice,
    searchMode,
    searchQuery,
    searchResults,
    setFileSelectionCount,
    setFocusedPane,
    setIsLeftSourceMode,
    setIsRightSourceMode,
    setIsWorkspaceRenameActive,
    setLinkContextMenu,
    setRailSidebarView,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery,
    setShowCommandPalette,
    setShowQuickSwitcher,
    setTabActive,
    setWorkspaceError,
    showCommandPalette,
    showQuickSwitcher,
    sidebarCreateFlight,
    sidebarViews,
    sidebarWidth,
    startRightPanelResize,
    startSidebarResize,
    t,
    toastMessage,
    toggleSplitWithMotion,
    toggleTabPinned,
    userDefinedFields,
    workspaceState
  });

  return <AppLayout {...appLayoutProps} />;
}

function resolveEnabledRightPanelView(
  currentView: RightPanelView,
  isOutlineAvailable: boolean,
  isLinksAvailable: boolean
): RightPanelView {
  if (currentView === "outline" && isOutlineAvailable) return "outline";
  if (currentView === "links" && isLinksAvailable) return "links";
  if (isOutlineAvailable) return "outline";
  return "links";
}
