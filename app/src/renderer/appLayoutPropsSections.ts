import type { AppLayoutProps } from "./components/AppLayout";
import type {
  AppLayoutEditorWorkspaceInput,
  AppLayoutFilesSidebarInput,
  AppLayoutOverlaysInput,
  AppLayoutPropsInput,
  AppLayoutRailInput,
  AppLayoutStatusBarInput
} from "./appLayoutPropsTypes";

type EditorWorkspaceProps = AppLayoutProps["editorWorkspaceProps"];
type FilesSidebarProps = AppLayoutProps["filesSidebarProps"];
type OverlaysProps = AppLayoutProps["overlaysProps"];
type RailProps = AppLayoutProps["railProps"];
type StatusBarProps = AppLayoutProps["statusBarProps"];
type TitleBarProps = AppLayoutProps["titleBarProps"];

export function createEditorWorkspaceProps(input: AppLayoutEditorWorkspaceInput): EditorWorkspaceProps {
  return {
    activeFileTab: input.activeFileTab,
    allFilePaths: input.allFilePaths,
    applyingReferenceKey: input.applyingReferenceKey,
    backlinks: input.backlinks,
    canReopenClosedTab: input.canReopenClosedTab,
    editorActionPulse: input.editorActionPulse,
    editorSettings: input.editorSettings,
    focusedPane: input.focusedPane,
    frontmatterCandidates: input.frontmatterCandidates,
    isLoadingBacklinks: input.isLoadingBacklinks,
    isLoadingUnlinkedReferences: input.isLoadingUnlinkedReferences,
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
    onReopenClosedTab: input.reopenClosedTab,
    onOpenLink: input.handleOpenMarkdownLink,
    onOpenWikiLink: input.handleOpenWikiLink,
    onApplyUnlinkedReference: input.onApplyUnlinkedReference,
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
    unlinkedReferences: input.unlinkedReferences,
    showRightPanelLinksControl: input.showRightPanelLinksControl,
    showRightPanelOutlineControl: input.showRightPanelOutlineControl,
    showRightPanelRecoveryControl: input.showRightPanelRecoveryControl,
    userDefinedFields: input.userDefinedFields,
    workspaceDataRevision: input.workspaceDataRevision,
    workspacePath: input.workspaceState?.activeWorkspace?.path
  };
}

export function createFilesSidebarProps(input: AppLayoutFilesSidebarInput): FilesSidebarProps {
  return {
    isCreatingFile: input.isCreatingFile,
    isCreatingFolder: input.isCreatingFolder,
    isCreatingWorkspace: input.isCreatingWorkspace,
    isOpeningWorkspace: input.isOpeningWorkspace,
    isSearching: input.isSearching,
    isSidebarOpen: input.isSidebarOpen,
    isSidebarResizing: input.isSidebarResizing,
    onCreateFile: input.handleCreateFileFromSidebar,
    onCreateFileInFolder: input.handleCreateFileInFolder,
    onCreateFolder: input.handleCreateFolderFromSidebar,
    onCreateFolderInFolder: input.handleCreateFolderInFolder,
    onCreateWorkspace: input.handleCreateNewWorkspace,
    onDeleteItem: input.handleDeleteTreeItem,
    onDeleteItems: input.handleDeleteTreeItems,
    onDuplicateFile: input.handleDuplicateTreeFile,
    onImportMarkdownFiles: input.handleImportMarkdownFiles,
    onMoveFile: input.handleMoveFile,
    onMoveFolder: input.handleMoveFolder,
    onMoveItems: input.handleMoveTreeItems,
    onOpenFile: input.handleSidebarOpenFile,
    onShowToast: input.showToast,
    onOpenInOtherPane: input.isSplit ? input.openTreeFileInOtherPane : undefined,
    onOpenQuickSwitcher: input.handleOpenQuickSwitcher,
    onOpenWorkspace: input.handleOpenWorkspace,
    onRenameItem: input.handleRenameTreeItem,
    onRevealItem: input.handleRevealWorkspaceItem,
    onSelectFolder: input.handleSelectFolder,
    onTogglePin: input.handleTogglePin,
    openingFilePath: input.openingFilePath,
    openFilePaths: input.openFilePathSet,
    searchError: input.searchError,
    searchFrontmatterField: input.searchFrontmatterField,
    searchLimitNotice: input.searchLimitNotice,
    searchMode: input.searchMode,
    searchQuery: input.searchQuery,
    searchResults: input.searchResults,
    sidebarWidth: input.sidebarWidth,
    startSidebarResize: input.startSidebarResize,
    workspaceState: input.workspaceState
  };
}

export function createOverlaysProps(input: AppLayoutOverlaysInput): OverlaysProps {
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

export function createRailProps(input: AppLayoutRailInput): RailProps {
  return {
    activeChartIds: input.activeChartIds,
    activePanelTabIds: input.activePanelTabIds,
    activeSidebarView: input.activeSidebarView,
    activeWorkspaceId: input.workspaceState?.activeWorkspace?.id ?? null,
    chartRailViews: input.chartRailViews,
    isSidebarOpen: input.isSidebarOpen,
    isRefreshingWorkspace: input.isRefreshingWorkspace,
    isWorkspaceRenameActive: input.isWorkspaceRenameActive,
    isWorkspaceRenameHoldingRail: input.isWorkspaceRenameHoldingRail,
    onChartButton: input.handleRailChartButton,
    onCloseSidebar: input.closeSidebar,
    onPanelButton: input.handleRailPanelButton,
    onRemoveWorkspace: input.handleRemoveWorkspace,
    onRefreshWorkspace: input.refreshWorkspace,
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
    copyWorkspacePathLabel: input.t("files.copyWorkspacePath"),
    removeWorkspaceLabel: input.removeWorkspaceLabel,
    refreshLabel: input.t("refresh.label"),
    renameLabel: input.t("files.rename"),
    revealWorkspaceLabel: input.t("files.revealInFinder"),
    viewSwitcherLabel: input.t("nav.viewSwitcher"),
    workspacesLabel: input.t("files.registeredWorkspaces")
  };
}

export function createStatusBarProps(input: AppLayoutStatusBarInput): StatusBarProps {
  return {
    activeFileTab: input.activeFileTab,
    language: input.language,
    onLanguageChange: input.onLanguageChange,
    saveStatus: input.activeFileTab ? input.saveStatusByTabId[input.activeFileTab.id] : undefined
  };
}

export function createTitleBarProps(input: AppLayoutPropsInput): TitleBarProps {
  return {
    canNavigateBack: input.shell.canNavigateBack,
    canNavigateForward: input.shell.canNavigateForward,
    isDarkTheme: input.shell.isDarkTheme,
    onNavigateBack: input.shell.navigateBack,
    onNavigateForward: input.shell.navigateForward,
    onThemeChange: (theme) => input.shell.handleSaveSettings({ ...input.shell.editorSettings, theme })
  };
}
