import type { AppLayoutProps } from "./components/AppLayout";
import type { AppLayoutPropsInput } from "./appLayoutProps";

type EditorWorkspaceProps = AppLayoutProps["editorWorkspaceProps"];
type FilesSidebarProps = AppLayoutProps["filesSidebarProps"];
type OverlaysProps = AppLayoutProps["overlaysProps"];
type RailProps = AppLayoutProps["railProps"];
type StatusBarProps = AppLayoutProps["statusBarProps"];
type TitleBarProps = AppLayoutProps["titleBarProps"];

export function createEditorWorkspaceProps(input: AppLayoutPropsInput): EditorWorkspaceProps {
  return {
    aiWorkspaceMessagePreview: input.aiWorkspaceMessagePreview,
    aiWorkspaceState: input.aiWorkspaceState,
    allFilePaths: input.existingMarkdownPaths,
    backlinks: input.backlinks,
    editorActionPulse: input.editorActionPulse,
    editorSettings: input.editorSettings,
    focusedPane: input.focusedPane,
    frontmatterCandidates: input.frontmatterCandidates,
    isAIWorkspaceLoading: input.isAIWorkspaceLoading,
    isAIWorkspaceSending: input.isAIWorkspaceSending,
    isLoadingBacklinks: input.isLoadingBacklinks,
    isRightPanelOpen: input.isEffectiveRightPanelOpen,
    isRightPanelResizing: input.isRightPanelResizing,
    isSecondarySidebarOpen: input.isSecondarySidebarOpen,
    isSecondarySidebarResizing: input.isSecondarySidebarResizing,
    isSourceMode: input.isSourceMode,
    isSplit: input.isSplit,
    isSplitClosing: input.isSplitClosing,
    isTypewriterMode: input.isTypewriterMode,
    leftEditorViewRef: input.leftEditorViewRef,
    leftPaneScrollHeading: input.leftPaneScrollHeading,
    ...input.aiWorkspaceEditorActions,
    ...input.appInlineHandlers,
    onCreateFile: input.handleCreateNoteFromPane,
    onFileSaveError: input.setWorkspaceError,
    onFileSaved: input.handleFileSaved,
    onOpenFile: input.handleOpenFile,
    onOpenLink: input.handleOpenMarkdownLink,
    onOpenWikiLink: input.handleOpenWikiLink,
    onRenameFile: (path, name) => input.handleRenameTreeItem(path, "file", name),
    onRightPanelResizeStart: input.startRightPanelResize,
    onSecondarySidebarClose: input.closeSecondarySidebar,
    onSecondarySidebarResizeStart: input.startSecondarySidebarResize,
    onSetFocusedPane: input.setFocusedPane,
    outlineHeadings: input.outlineHeadings,
    outgoingLinks: input.outgoingLinks,
    outgoingLinksLimited: input.outgoingLinksLimited,
    renderChartTab: input.renderChartTab,
    renderPanelTab: input.renderPanelTab,
    rightEditorViewRef: input.rightEditorViewRef,
    rightPaneScrollHeading: input.rightPaneScrollHeading,
    rightPanelView: input.rightPanelView,
    rightPanelWidth: input.rightPanelWidth,
    secondarySidebarView: input.secondarySidebarView,
    secondarySidebarWidth: input.secondarySidebarWidth,
    setLinkContextMenu: input.setLinkContextMenu,
    userDefinedFields: input.userDefinedFields,
    workspaceName: input.workspaceState?.activeWorkspace?.name,
    workspacePath: input.workspaceState?.activeWorkspace?.path
  };
}

export function createFilesSidebarProps(input: AppLayoutPropsInput): FilesSidebarProps {
  return {
    activeSidebarView: input.activeSidebarView,
    aiWorkspaceState: input.aiWorkspaceState,
    fileSelectionCount: input.fileSelectionCount,
    isAIWorkspaceLoading: input.isAIWorkspaceLoading,
    isCreatingFile: input.isCreatingFile,
    isCreatingFolder: input.isCreatingFolder,
    isCreatingWorkspace: input.isCreatingWorkspace,
    isOpeningWorkspace: input.isOpeningWorkspace,
    isSearching: input.isSearching,
    isSidebarOpen: input.isSidebarOpen,
    isSidebarResizing: input.isSidebarResizing,
    onCloseSidebar: input.closeSidebar,
    onCreateAIChat: () => {
      input.openSecondarySidebar("ai-chat");
      void input.createAIWorkspaceChat();
    },
    onCreateFile: input.handleCreateFileFromSidebar,
    onCreateFileInFolder: input.handleCreateFileInFolder,
    onCreateFolder: input.handleCreateFolderFromSidebar,
    onCreateFolderInFolder: input.handleCreateFolderInFolder,
    onCreateWorkspace: input.handleCreateNewWorkspace,
    onDeleteAIChat: (chatId) => { void input.deleteAIWorkspaceChat(chatId); },
    onDeleteItem: input.handleDeleteTreeItem,
    onDeleteItems: input.handleDeleteTreeItems,
    onDuplicateFile: input.handleDuplicateTreeFile,
    onMoveFile: input.handleMoveFile,
    onMoveFolder: input.handleMoveFolder,
    onMoveItems: input.handleMoveTreeItems,
    onOpenFile: input.handleSidebarOpenFile,
    onOpenInOtherPane: input.isSplit ? input.openTreeFileInOtherPane : undefined,
    onOpenWorkspace: input.handleOpenWorkspace,
    onRenameItem: input.handleRenameTreeItem,
    onRevealItem: input.handleRevealWorkspaceItem,
    onSearchFrontmatterFieldChange: input.setSearchFrontmatterField,
    onSearchModeChange: input.setSearchMode,
    onSearchQueryChange: input.setSearchQuery,
    onSelectAIChat: (chatId) => {
      input.openSecondarySidebar("ai-chat");
      void input.selectAIWorkspaceChat(chatId);
    },
    onSelectFolder: input.handleSelectFolder,
    onSelectedCountChange: input.setFileSelectionCount,
    onTogglePin: input.handleTogglePin,
    openingFilePath: input.openingFilePath,
    openFilePaths: input.openFilePathSet,
    searchError: input.searchError,
    searchFocusRequest: input.fileSearchFocusRequest,
    searchFrontmatterCandidates: input.frontmatterCandidates,
    searchFrontmatterField: input.searchFrontmatterField,
    searchFrontmatterFields: input.frontmatterSearchFields,
    searchLimitNotice: input.searchLimitNotice,
    searchMode: input.searchMode,
    searchQuery: input.searchQuery,
    searchResults: input.searchResults,
    selectedCountLabel: input.t("files.selectedCount", { count: input.fileSelectionCount }),
    sidebarViews: input.sidebarViews,
    sidebarWidth: input.sidebarWidth,
    startSidebarResize: input.startSidebarResize,
    workspaceState: input.workspaceState
  };
}

export function createOverlaysProps(input: AppLayoutPropsInput): OverlaysProps {
  return {
    aliasesByPath: input.aliasesByPath,
    closeToast: input.closeToast,
    commands: input.commands,
    existingMarkdownPaths: input.existingMarkdownPaths,
    handleOpenFile: input.handleOpenFile,
    handleOpenWikiLink: input.handleOpenWikiLink,
    handleRevealWorkspaceItem: input.handleRevealWorkspaceItem,
    isSplit: input.isSplit,
    isToastClosing: input.isToastClosing,
    linkContextMenu: input.linkContextMenu,
    openWorkspacePathInOtherPane: input.openWorkspacePathInOtherPane,
    railTabFlight: input.railTabFlight,
    setLinkContextMenu: input.setLinkContextMenu,
    setShowCommandPalette: input.setShowCommandPalette,
    setShowQuickSwitcher: input.setShowQuickSwitcher,
    showCommandPalette: input.showCommandPalette,
    showQuickSwitcher: input.showQuickSwitcher,
    sidebarCreateFlight: input.sidebarCreateFlight,
    toastMessage: input.toastMessage
  };
}

export function createRailProps(input: AppLayoutPropsInput): RailProps {
  return {
    activeChartIds: input.activeChartIds,
    activePanelTabIds: input.activePanelTabIds,
    activeSidebarView: input.activeSidebarView,
    activeWorkspaceId: input.workspaceState?.activeWorkspace?.id ?? null,
    chartRailViews: input.chartRailViews,
    isSidebarOpen: input.isSidebarOpen,
    isWorkspaceRenameActive: input.isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail: input.isWorkspaceRenameHoldingRail,
    onChartButton: input.handleRailChartButton,
    onCloseSidebar: input.closeSidebar,
    onPanelButton: input.handleRailPanelButton,
    onRemoveWorkspace: input.handleRemoveWorkspace,
    onRevealWorkspace: input.handleRevealWorkspace,
    onRenameActiveChange: input.setIsWorkspaceRenameActive,
    onRenameComplete: input.holdWorkspaceRailAfterRename,
    onRenameWorkspace: input.handleRenameWorkspace,
    onSetSidebarView: input.setRailSidebarView,
    onSwitchWorkspace: input.handleSwitchWorkspace,
    openChartIds: input.openChartIds,
    openPanelTabIds: input.openPanelTabIds,
    panelRailViews: input.panelRailViews,
    primaryRailViews: input.primaryRailViews,
    registeredWorkspaces: input.registeredWorkspaces,
    removeWorkspaceLabel: (name) => input.t("files.removeWorkspace", { name }),
    renameLabel: input.t("files.rename"),
    revealWorkspaceLabel: input.t("files.revealInFinder"),
    viewSwitcherLabel: input.t("nav.viewSwitcher"),
    workspacesLabel: input.t("files.registeredWorkspaces")
  };
}

export function createStatusBarProps(input: AppLayoutPropsInput): StatusBarProps {
  return {
    activeFileTab: input.activeFileTabInFocusedPane,
    saveStatus: input.activeFileTabInFocusedPane ? input.saveStatusByTabId[input.activeFileTabInFocusedPane.id] : undefined
  };
}

export function createTitleBarProps(input: AppLayoutPropsInput): TitleBarProps {
  return {
    isRightPanelOpen: input.isEffectiveRightPanelOpen,
    isSourceMode: input.isSourceMode,
    isSplit: input.isSplit,
    leftClosingTabIds: input.leftClosingTabIds,
    leftOffsetWidth: input.titleBarLeftOffsetWidth,
    leftPane: input.leftPane,
    onCloseAllTabsInPane: input.closeAllTabsInPaneWithMotion,
    onCloseOtherTabs: input.closeOtherTabsWithMotion,
    onCloseTabsToRight: input.closeTabsToRightWithMotion,
    onDuplicateTabFile: input.handleDuplicateTabFile,
    onOpenInOtherPane: input.openFileInOtherPane,
    onPrintPreview: input.handlePrintPreview,
    onRevealTabFile: input.handleRevealTabFile,
    onRightPanelViewButton: input.handleRightPanelViewButton,
    onSavePreviewAsPdf: input.handleSavePreviewAsPdf,
    onSourceModeToggle: () => input.setIsSourceMode((value) => !value),
    onSplitToggle: input.toggleSplitWithMotion,
    onTabClose: input.closeTabWithMotion,
    onTabMove: input.moveTab,
    onTabSelect: input.setTabActive,
    onTogglePinTab: input.toggleTabPinned,
    renderPanelTabIcon: input.renderPanelTabIcon,
    rightClosingTabIds: input.rightClosingTabIds,
    rightPane: input.rightPane,
    rightPanelView: input.rightPanelView,
    rightPanelWidth: input.rightPanelWidth,
    showRightPanelLinksControl: input.featureRightPanelLinksAvailable,
    showRightPanelOutlineControl: input.featureRightPanelOutlineAvailable,
    tabs: input.tabs
  };
}
