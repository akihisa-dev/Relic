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
    activeFileTab: input.activeFileTabForRightPanel,
    allFilePaths: input.existingMarkdownPaths,
    backlinks: input.backlinks,
    editorActionPulse: input.editorActionPulse,
    editorSettings: input.editorSettings,
    focusedPane: input.focusedPane,
    frontmatterCandidates: input.frontmatterCandidates,
    isLoadingBacklinks: input.isLoadingBacklinks,
    isRightPanelOpen: input.isEffectiveRightPanelOpen,
    isRightPanelResizing: input.isRightPanelResizing,
    isLeftSourceMode: input.isLeftSourceMode,
    isRightSourceMode: input.isRightSourceMode,
    isSplit: input.isSplit,
    isSplitClosing: input.isSplitClosing,
    isTypewriterMode: input.isTypewriterMode,
    leftClosingTabIds: input.leftClosingTabIds,
    leftEditorViewRef: input.leftEditorViewRef,
    leftPaneScrollHeading: input.leftPaneScrollHeading,
    ...input.appInlineHandlers,
    onCloseAllTabsInPane: input.closeAllTabsInPaneWithMotion,
    onCloseOtherTabs: input.closeOtherTabsWithMotion,
    onCloseTabsToRight: input.closeTabsToRightWithMotion,
    onCreateFile: input.handleCreateNoteFromPane,
    onDuplicateTabFile: input.handleDuplicateTabFile,
    onFileSaveError: input.setWorkspaceError,
    onFileSaved: input.handleFileSaved,
    onLargeMarkdownFallback: input.handleLargeMarkdownFallback,
    onOpenFile: input.handleOpenFile,
    onOpenInOtherPane: input.openFileInOtherPane,
    onOpenLink: input.handleOpenMarkdownLink,
    onOpenWikiLink: input.handleOpenWikiLink,
    onPrintPreview: input.handlePrintPreview,
    onRenameFile: (path, name) => input.handleRenameTreeItem(path, "file", name),
    onRevealTabFile: input.handleRevealTabFile,
    onRightPanelResizeStart: input.startRightPanelResize,
    onRightPanelViewButton: input.handleRightPanelViewButton,
    onSavePreviewAsPdf: input.handleSavePreviewAsPdf,
    onSetFocusedPane: input.setFocusedPane,
    onSourceModeToggle: (pane) => {
      if (pane === "right") {
        input.setIsRightSourceMode((value) => !value);
        return;
      }

      input.setIsLeftSourceMode((value) => !value);
    },
    onSplitToggle: input.toggleSplitWithMotion,
    onTabClose: input.closeTabWithMotion,
    onTabMove: input.moveTab,
    onTabSelect: input.setTabActive,
    onTogglePinTab: input.toggleTabPinned,
    outlineHeadings: input.outlineHeadings,
    outgoingLinks: input.outgoingLinks,
    outgoingLinksLimited: input.outgoingLinksLimited,
    renderChartTab: input.renderChartTab,
    renderPanelTab: input.renderPanelTab,
    renderPanelTabIcon: input.renderPanelTabIcon,
    rightClosingTabIds: input.rightClosingTabIds,
    rightEditorViewRef: input.rightEditorViewRef,
    rightPaneScrollHeading: input.rightPaneScrollHeading,
    rightPanelView: input.rightPanelView,
    rightPanelWidth: input.rightPanelWidth,
    setLinkContextMenu: input.setLinkContextMenu,
    onUpdateTabContent: input.updateTabContent,
    showRightPanelFrontmatterControl: input.featureRightPanelFrontmatterAvailable,
    showRightPanelLinksControl: input.featureRightPanelLinksAvailable,
    showRightPanelOutlineControl: input.featureRightPanelOutlineAvailable,
    userDefinedFields: input.userDefinedFields,
    workspacePath: input.workspaceState?.activeWorkspace?.path
  };
}

export function createFilesSidebarProps(input: AppLayoutPropsInput): FilesSidebarProps {
  return {
    activeSidebarView: input.activeSidebarView,
    fileSelectionCount: input.fileSelectionCount,
    isCreatingFile: input.isCreatingFile,
    isCreatingFolder: input.isCreatingFolder,
    isCreatingWorkspace: input.isCreatingWorkspace,
    isOpeningWorkspace: input.isOpeningWorkspace,
    isSearching: input.isSearching,
    isSidebarOpen: input.isSidebarOpen,
    isSidebarResizing: input.isSidebarResizing,
    onCloseSidebar: input.closeSidebar,
    onCreateFile: input.handleCreateFileFromSidebar,
    onCreateFileInFolder: input.handleCreateFileInFolder,
    onCreateFolder: input.handleCreateFolderFromSidebar,
    onCreateFolderInFolder: input.handleCreateFolderInFolder,
    onCreateDiagramFile: input.handleCreateDiagramFile,
    onCreateWorkspace: input.handleCreateNewWorkspace,
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

export function createTitleBarProps(_input: AppLayoutPropsInput): TitleBarProps {
  return {};
}
