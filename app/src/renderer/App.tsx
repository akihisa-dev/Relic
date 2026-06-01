import type { EditorView } from "@codemirror/view";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { type WorkspaceState } from "../shared/ipc";
import type { AppLinkContextMenu } from "./appLinks";
import { createAppLayoutProps } from "./appLayoutProps";
import { AppLayout } from "./components/AppLayout";
import { createTranslator } from "./i18nModel";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAIWorkspaceState } from "./hooks/useAIWorkspaceState";
import { useAIWorkspaceEditorActions } from "./hooks/useAIWorkspaceEditorActions";
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
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<string | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<string | undefined>(undefined);
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
    isSecondarySidebarOpen,
    isSidebarOpen,
    isTypewriterMode,
    rightPanelView,
    secondarySidebarView,
    closeSecondarySidebar,
    openSecondarySidebar,
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
  const {
    aiWorkspaceState,
    aiWorkspaceMessagePreview,
    isAIWorkspaceLoading,
    isAIWorkspaceSending,
    applyAIWorkspaceOperations,
    cancelAIWorkspaceMessage,
    confirmAIWorkspaceMessage,
    createAIWorkspaceChat,
    deleteAIWorkspaceChat,
    discardAIWorkspaceOperations,
    rebuildAIWorkspaceIndex,
    reloadAIWorkspace,
    selectAIWorkspaceChat,
    sendAIWorkspaceMessage,
    clearAIWorkspaceData
  } = useAIWorkspaceState({
    isEnabled: Boolean(workspaceState?.activeWorkspace),
    onError: setWorkspaceError,
    workspaceId: workspaceState?.activeWorkspace?.id
  });

  const toggleSidebar = useCallback((): void => {
    if (isWorkspaceRenameActive) return;
    toggleSidebarState();
  }, [isWorkspaceRenameActive, toggleSidebarState]);

  const t = useMemo(() => createTranslator(editorSettings.language), [editorSettings.language]);
  const {
    aiSettings,
    aiSettingsStatus,
    appUiSettings,
    appInfo,
    featureToggles,
    handleDeleteOpenAIAPIKey,
    handleSaveFeatureToggles,
    handleSaveAppUiSettings,
    handleSaveAIModel,
    handleSaveAIProvider,
    handleSaveOpenAIAPIKey,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleTestOpenAIAPIKey,
    userDefinedFields
  } = useAppSettingsState({
    onAISettingsChanged: () => { void reloadAIWorkspace(); },
    setEditorSettings,
    setWorkspaceError,
    setWorkspaceState,
    t
  });
  const isRightPanelAvailable = featureToggles.rightPanel;
  const isEffectiveRightPanelOpen = isRightPanelAvailable && isRightPanelOpen;
  const toggleRightPanelIfAvailable = useCallback((): void => {
    if (!isRightPanelAvailable) return;
    toggleRightPanel();
  }, [isRightPanelAvailable, toggleRightPanel]);

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
    dirtyMarkdownPaths,
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
    openSecondarySidebar,
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
    isSecondarySidebarResizing,
    isSidebarResizing,
    rightPanelWidth,
    secondarySidebarWidth,
    sidebarWidth,
    startRightPanelResize,
    startSecondarySidebarResize,
    startSidebarResize,
    titleBarLeftOffsetWidth
  } = useAppLayoutWidths({
    appUiSettings,
    handleSaveAppUiSettings,
    isSecondarySidebarOpen
  });

  const leftEditorViewRef = useRef<EditorView | null>(null);
  const rightEditorViewRef = useRef<EditorView | null>(null);

  const handleRightPanelViewButton = useCallback((view: RightPanelView): void => {
    if (isEffectiveRightPanelOpen && rightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [isEffectiveRightPanelOpen, rightPanelView, setRightPanelView, toggleRightPanel]);

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
  const aiWorkspaceEditorActions = useAIWorkspaceEditorActions({
    activeFileTab: activeFileTabInFocusedPane,
    applyAIWorkspaceOperations,
    cancelAIWorkspaceMessage,
    clearAIWorkspaceData,
    confirmAIWorkspaceMessage,
    dirtyMarkdownPaths,
    discardAIWorkspaceOperations,
    rebuildAIWorkspaceIndex,
    sendAIWorkspaceMessage
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
    openSecondarySidebar,
    panelLabels,
    setSidebarView
  });

  const { renderChartTab, renderPanelTab } = useAppTabRenderers({
    appInfo,
    aiSettings,
    aiSettingsStatus,
    chronicleCalendars,
    editorSettings,
    featureToggles,
    charts,
    handleOpenFile,
    handleDeleteOpenAIAPIKey,
    handleSaveChronicleCalendars,
    handleSaveFeatureToggles,
    handleSaveAIModel,
    handleSaveAIProvider,
    handleSaveOpenAIAPIKey,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleTestOpenAIAPIKey,
    handleUpdateChartEntry,
    userDefinedFields,
    workspaceState
  });
  const appLayoutProps = createAppLayoutProps({
    activeChartIds,
    activeFileTabInFocusedPane,
    activePanelTabIds,
    activeSidebarView,
    aiWorkspaceEditorActions,
    aiWorkspaceMessagePreview,
    aiWorkspaceState,
    aliasesByPath,
    appInlineHandlers,
    backlinks,
    chartRailViews,
    closeAllTabsInPaneWithMotion,
    closeOtherTabsWithMotion,
    closeSecondarySidebar,
    closeSidebar,
    closeTabWithMotion,
    closeTabsToRightWithMotion,
    closeToast,
    commands,
    createAIWorkspaceChat,
    deleteAIWorkspaceChat,
    editorActionPulse,
    editorSettings,
    existingMarkdownPaths,
    featureRightPanelAvailable: isRightPanelAvailable,
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
    isAIWorkspaceLoading,
    isAIWorkspaceSending,
    isCreatingFile,
    isCreatingFolder,
    isCreatingWorkspace,
    isEffectiveRightPanelOpen,
    isLoadingBacklinks,
    isOpeningWorkspace,
    isRightPanelResizing,
    isSearching,
    isSecondarySidebarOpen,
    isSecondarySidebarResizing,
    isSidebarOpen,
    isSidebarResizing,
    isSourceMode,
    isSplit,
    isSplitClosing,
    isToastClosing,
    isTypewriterMode,
    isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail,
    leftClosingTabIds,
    leftEditorViewRef,
    leftPane,
    leftPaneScrollHeading,
    linkContextMenu,
    moveTab,
    openChartIds,
    openFileInOtherPane,
    openFilePathSet,
    openPanelTabIds,
    openSecondarySidebar,
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
    rightPane,
    rightPaneScrollHeading,
    rightPanelView,
    rightPanelWidth,
    saveStatusByTabId,
    searchError,
    searchFrontmatterField,
    searchLimitNotice,
    searchMode,
    searchQuery,
    searchResults,
    secondarySidebarView,
    secondarySidebarWidth,
    selectAIWorkspaceChat,
    setFileSelectionCount,
    setFocusedPane,
    setIsSourceMode,
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
    startSecondarySidebarResize,
    startSidebarResize,
    t,
    tabs,
    titleBarLeftOffsetWidth,
    toastMessage,
    toggleSplitWithMotion,
    toggleTabPinned,
    userDefinedFields,
    workspaceState
  });

  return <AppLayout {...appLayoutProps} />;
}
