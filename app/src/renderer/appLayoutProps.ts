import type { AppLayoutProps } from "./components/AppLayout";
import type { Translator } from "./i18nModel";

type EditorWorkspaceProps = AppLayoutProps["editorWorkspaceProps"];
type FilesSidebarProps = AppLayoutProps["filesSidebarProps"];
type OverlaysProps = AppLayoutProps["overlaysProps"];
type RailProps = AppLayoutProps["railProps"];
type StatusBarProps = AppLayoutProps["statusBarProps"];
type TitleBarProps = AppLayoutProps["titleBarProps"];

interface AppLayoutPropsInput {
  activeChartIds: RailProps["activeChartIds"];
  activeFileTabInFocusedPane: StatusBarProps["activeFileTab"];
  activePanelTabIds: RailProps["activePanelTabIds"];
  activeSidebarView: RailProps["activeSidebarView"];
  aiWorkspaceEditorActions: Pick<
    EditorWorkspaceProps,
    | "onAIWorkspaceApplyOperations"
    | "onAIWorkspaceCancelMessagePreview"
    | "onAIWorkspaceCancelSending"
    | "onAIWorkspaceClearData"
    | "onAIWorkspaceConfirmMessagePreview"
    | "onAIWorkspaceDiscardOperations"
    | "onAIWorkspaceRebuildIndex"
    | "onAIWorkspaceSendMessage"
  >;
  aiWorkspaceMessagePreview: EditorWorkspaceProps["aiWorkspaceMessagePreview"];
  aiWorkspaceState: EditorWorkspaceProps["aiWorkspaceState"];
  aliasesByPath: OverlaysProps["aliasesByPath"];
  appInlineHandlers: Pick<
    EditorWorkspaceProps,
    "onEditorAction" | "onOutlineHeadingClick" | "onScrollTargetHandled"
  >;
  backlinks: EditorWorkspaceProps["backlinks"];
  chartRailViews: RailProps["chartRailViews"];
  closeAllTabsInPaneWithMotion: TitleBarProps["onCloseAllTabsInPane"];
  closeOtherTabsWithMotion: TitleBarProps["onCloseOtherTabs"];
  closeSecondarySidebar: EditorWorkspaceProps["onSecondarySidebarClose"];
  closeSidebar: FilesSidebarProps["onCloseSidebar"];
  closeTabWithMotion: TitleBarProps["onTabClose"];
  closeTabsToRightWithMotion: TitleBarProps["onCloseTabsToRight"];
  closeToast: OverlaysProps["closeToast"];
  commands: OverlaysProps["commands"];
  createAIWorkspaceChat: () => Promise<void>;
  deleteAIWorkspaceChat: (chatId: string) => Promise<void>;
  editorActionPulse: EditorWorkspaceProps["editorActionPulse"];
  editorSettings: EditorWorkspaceProps["editorSettings"];
  existingMarkdownPaths: EditorWorkspaceProps["allFilePaths"];
  featureRightPanelAvailable: TitleBarProps["showRightPanelControls"];
  fileSearchFocusRequest: FilesSidebarProps["searchFocusRequest"];
  fileSelectionCount: FilesSidebarProps["fileSelectionCount"];
  focusedPane: EditorWorkspaceProps["focusedPane"];
  frontmatterCandidates: EditorWorkspaceProps["frontmatterCandidates"];
  frontmatterSearchFields: FilesSidebarProps["searchFrontmatterFields"];
  handleCreateFileFromSidebar: FilesSidebarProps["onCreateFile"];
  handleCreateFileInFolder: FilesSidebarProps["onCreateFileInFolder"];
  handleCreateFolderFromSidebar: FilesSidebarProps["onCreateFolder"];
  handleCreateFolderInFolder: FilesSidebarProps["onCreateFolderInFolder"];
  handleCreateNewWorkspace: FilesSidebarProps["onCreateWorkspace"];
  handleCreateNoteFromPane: EditorWorkspaceProps["onCreateFile"];
  handleDeleteTreeItem: FilesSidebarProps["onDeleteItem"];
  handleDeleteTreeItems: FilesSidebarProps["onDeleteItems"];
  handleDuplicateTabFile: TitleBarProps["onDuplicateTabFile"];
  handleDuplicateTreeFile: FilesSidebarProps["onDuplicateFile"];
  handleFileSaved: EditorWorkspaceProps["onFileSaved"];
  handleMoveFile: FilesSidebarProps["onMoveFile"];
  handleMoveFolder: FilesSidebarProps["onMoveFolder"];
  handleMoveTreeItems: FilesSidebarProps["onMoveItems"];
  handleOpenFile: EditorWorkspaceProps["onOpenFile"];
  handleOpenMarkdownLink: EditorWorkspaceProps["onOpenLink"];
  handleOpenWikiLink: EditorWorkspaceProps["onOpenWikiLink"];
  handleOpenWorkspace: FilesSidebarProps["onOpenWorkspace"];
  handlePrintPreview: TitleBarProps["onPrintPreview"];
  handleRailChartButton: RailProps["onChartButton"];
  handleRailPanelButton: RailProps["onPanelButton"];
  handleRemoveWorkspace: RailProps["onRemoveWorkspace"];
  handleRenameTreeItem: FilesSidebarProps["onRenameItem"];
  handleRenameWorkspace: RailProps["onRenameWorkspace"];
  handleRevealTabFile: TitleBarProps["onRevealTabFile"];
  handleRevealWorkspaceItem: OverlaysProps["handleRevealWorkspaceItem"];
  handleRightPanelViewButton: TitleBarProps["onRightPanelViewButton"];
  handleSavePreviewAsPdf: TitleBarProps["onSavePreviewAsPdf"];
  handleSelectFolder: FilesSidebarProps["onSelectFolder"];
  handleSidebarOpenFile: FilesSidebarProps["onOpenFile"];
  handleSwitchWorkspace: RailProps["onSwitchWorkspace"];
  handleTogglePin: FilesSidebarProps["onTogglePin"];
  holdWorkspaceRailAfterRename: RailProps["onRenameComplete"];
  isAIWorkspaceLoading: EditorWorkspaceProps["isAIWorkspaceLoading"];
  isAIWorkspaceSending: EditorWorkspaceProps["isAIWorkspaceSending"];
  isCreatingFile: FilesSidebarProps["isCreatingFile"];
  isCreatingFolder: FilesSidebarProps["isCreatingFolder"];
  isCreatingWorkspace: FilesSidebarProps["isCreatingWorkspace"];
  isEffectiveRightPanelOpen: TitleBarProps["isRightPanelOpen"];
  isLoadingBacklinks: EditorWorkspaceProps["isLoadingBacklinks"];
  isOpeningWorkspace: FilesSidebarProps["isOpeningWorkspace"];
  isRightPanelResizing: EditorWorkspaceProps["isRightPanelResizing"];
  isSearching: FilesSidebarProps["isSearching"];
  isSecondarySidebarOpen: EditorWorkspaceProps["isSecondarySidebarOpen"];
  isSecondarySidebarResizing: EditorWorkspaceProps["isSecondarySidebarResizing"];
  isSidebarOpen: RailProps["isSidebarOpen"];
  isSidebarResizing: FilesSidebarProps["isSidebarResizing"];
  isSourceMode: TitleBarProps["isSourceMode"];
  isSplit: TitleBarProps["isSplit"];
  isSplitClosing: EditorWorkspaceProps["isSplitClosing"];
  isToastClosing: OverlaysProps["isToastClosing"];
  isTypewriterMode: EditorWorkspaceProps["isTypewriterMode"];
  isWorkspaceRenameActive: RailProps["isWorkspaceRenameActive"];
  isWorkspaceRenameHoldingRail: RailProps["isWorkspaceRenameHoldingRail"];
  leftClosingTabIds: TitleBarProps["leftClosingTabIds"];
  leftEditorViewRef: EditorWorkspaceProps["leftEditorViewRef"];
  leftPane: TitleBarProps["leftPane"];
  leftPaneScrollHeading: EditorWorkspaceProps["leftPaneScrollHeading"];
  linkContextMenu: OverlaysProps["linkContextMenu"];
  moveTab: TitleBarProps["onTabMove"];
  openChartIds: RailProps["openChartIds"];
  openFileInOtherPane: TitleBarProps["onOpenInOtherPane"];
  openFilePathSet: FilesSidebarProps["openFilePaths"];
  openPanelTabIds: RailProps["openPanelTabIds"];
  openSecondarySidebar: (view: "ai-chat") => void;
  openTreeFileInOtherPane: FilesSidebarProps["onOpenInOtherPane"];
  openWorkspacePathInOtherPane: OverlaysProps["openWorkspacePathInOtherPane"];
  openingFilePath: FilesSidebarProps["openingFilePath"];
  outlineHeadings: EditorWorkspaceProps["outlineHeadings"];
  outgoingLinks: EditorWorkspaceProps["outgoingLinks"];
  outgoingLinksLimited: EditorWorkspaceProps["outgoingLinksLimited"];
  panelRailViews: RailProps["panelRailViews"];
  primaryRailViews: RailProps["primaryRailViews"];
  railTabFlight: OverlaysProps["railTabFlight"];
  registeredWorkspaces: RailProps["registeredWorkspaces"];
  renderChartTab: EditorWorkspaceProps["renderChartTab"];
  renderPanelTab: EditorWorkspaceProps["renderPanelTab"];
  renderPanelTabIcon: TitleBarProps["renderPanelTabIcon"];
  rightClosingTabIds: TitleBarProps["rightClosingTabIds"];
  rightEditorViewRef: EditorWorkspaceProps["rightEditorViewRef"];
  rightPane: TitleBarProps["rightPane"];
  rightPaneScrollHeading: EditorWorkspaceProps["rightPaneScrollHeading"];
  rightPanelView: TitleBarProps["rightPanelView"];
  rightPanelWidth: TitleBarProps["rightPanelWidth"];
  saveStatusByTabId: Record<string, StatusBarProps["saveStatus"]>;
  searchError: FilesSidebarProps["searchError"];
  searchFrontmatterField: FilesSidebarProps["searchFrontmatterField"];
  searchLimitNotice: FilesSidebarProps["searchLimitNotice"];
  searchMode: FilesSidebarProps["searchMode"];
  searchQuery: FilesSidebarProps["searchQuery"];
  searchResults: FilesSidebarProps["searchResults"];
  secondarySidebarView: EditorWorkspaceProps["secondarySidebarView"];
  secondarySidebarWidth: EditorWorkspaceProps["secondarySidebarWidth"];
  selectAIWorkspaceChat: (chatId: string) => Promise<void>;
  setFileSelectionCount: FilesSidebarProps["onSelectedCountChange"];
  setIsSourceMode: (updater: (value: boolean) => boolean) => void;
  setIsWorkspaceRenameActive: RailProps["onRenameActiveChange"];
  setLinkContextMenu: OverlaysProps["setLinkContextMenu"];
  setFocusedPane: EditorWorkspaceProps["onSetFocusedPane"];
  setRailSidebarView: RailProps["onSetSidebarView"];
  setSearchFrontmatterField: FilesSidebarProps["onSearchFrontmatterFieldChange"];
  setSearchMode: FilesSidebarProps["onSearchModeChange"];
  setSearchQuery: FilesSidebarProps["onSearchQueryChange"];
  setShowCommandPalette: OverlaysProps["setShowCommandPalette"];
  setShowQuickSwitcher: OverlaysProps["setShowQuickSwitcher"];
  setTabActive: TitleBarProps["onTabSelect"];
  setWorkspaceError: EditorWorkspaceProps["onFileSaveError"];
  showCommandPalette: OverlaysProps["showCommandPalette"];
  showQuickSwitcher: OverlaysProps["showQuickSwitcher"];
  sidebarCreateFlight: OverlaysProps["sidebarCreateFlight"];
  sidebarViews: FilesSidebarProps["sidebarViews"];
  sidebarWidth: FilesSidebarProps["sidebarWidth"];
  startRightPanelResize: EditorWorkspaceProps["onRightPanelResizeStart"];
  startSecondarySidebarResize: EditorWorkspaceProps["onSecondarySidebarResizeStart"];
  startSidebarResize: FilesSidebarProps["startSidebarResize"];
  t: Translator;
  tabs: TitleBarProps["tabs"];
  titleBarLeftOffsetWidth: TitleBarProps["leftOffsetWidth"];
  toastMessage: OverlaysProps["toastMessage"];
  toggleSplitWithMotion: TitleBarProps["onSplitToggle"];
  toggleTabPinned: TitleBarProps["onTogglePinTab"];
  userDefinedFields: EditorWorkspaceProps["userDefinedFields"];
  workspaceState: FilesSidebarProps["workspaceState"];
}

export function createAppLayoutProps({
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
  featureRightPanelAvailable,
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
}: AppLayoutPropsInput): AppLayoutProps {
  return {
    editorWorkspaceProps: {
      aiWorkspaceMessagePreview,
      aiWorkspaceState,
      allFilePaths: existingMarkdownPaths,
      backlinks,
      editorActionPulse,
      editorSettings,
      focusedPane,
      frontmatterCandidates,
      isAIWorkspaceLoading,
      isAIWorkspaceSending,
      isLoadingBacklinks,
      isRightPanelOpen: isEffectiveRightPanelOpen,
      isRightPanelResizing,
      isSecondarySidebarOpen,
      isSecondarySidebarResizing,
      isSourceMode,
      isSplit,
      isSplitClosing,
      isTypewriterMode,
      leftEditorViewRef,
      leftPaneScrollHeading,
      ...aiWorkspaceEditorActions,
      ...appInlineHandlers,
      onCreateFile: handleCreateNoteFromPane,
      onFileSaveError: setWorkspaceError,
      onFileSaved: handleFileSaved,
      onOpenFile: handleOpenFile,
      onOpenLink: handleOpenMarkdownLink,
      onOpenWikiLink: handleOpenWikiLink,
      onRenameFile: (path, name) => handleRenameTreeItem(path, "file", name),
      onRightPanelResizeStart: startRightPanelResize,
      onSecondarySidebarClose: closeSecondarySidebar,
      onSecondarySidebarResizeStart: startSecondarySidebarResize,
      onSetFocusedPane: setFocusedPane,
      outlineHeadings,
      outgoingLinks,
      outgoingLinksLimited,
      renderChartTab,
      renderPanelTab,
      rightEditorViewRef,
      rightPaneScrollHeading,
      rightPanelView,
      rightPanelWidth,
      secondarySidebarView,
      secondarySidebarWidth,
      setLinkContextMenu,
      userDefinedFields,
      workspaceName: workspaceState?.activeWorkspace?.name,
      workspacePath: workspaceState?.activeWorkspace?.path
    },
    filesSidebarProps: {
      activeSidebarView,
      aiWorkspaceState,
      fileSelectionCount,
      isAIWorkspaceLoading,
      isCreatingFile,
      isCreatingFolder,
      isCreatingWorkspace,
      isOpeningWorkspace,
      isSearching,
      isSidebarOpen,
      isSidebarResizing,
      onCloseSidebar: closeSidebar,
      onCreateAIChat: () => {
        openSecondarySidebar("ai-chat");
        void createAIWorkspaceChat();
      },
      onCreateFile: handleCreateFileFromSidebar,
      onCreateFileInFolder: handleCreateFileInFolder,
      onCreateFolder: handleCreateFolderFromSidebar,
      onCreateFolderInFolder: handleCreateFolderInFolder,
      onCreateWorkspace: handleCreateNewWorkspace,
      onDeleteAIChat: (chatId) => { void deleteAIWorkspaceChat(chatId); },
      onDeleteItem: handleDeleteTreeItem,
      onDeleteItems: handleDeleteTreeItems,
      onDuplicateFile: handleDuplicateTreeFile,
      onMoveFile: handleMoveFile,
      onMoveFolder: handleMoveFolder,
      onMoveItems: handleMoveTreeItems,
      onOpenFile: handleSidebarOpenFile,
      onOpenInOtherPane: isSplit ? openTreeFileInOtherPane : undefined,
      onOpenWorkspace: handleOpenWorkspace,
      onRenameItem: handleRenameTreeItem,
      onRevealItem: handleRevealWorkspaceItem,
      onSearchFrontmatterFieldChange: setSearchFrontmatterField,
      onSearchModeChange: setSearchMode,
      onSearchQueryChange: setSearchQuery,
      onSelectAIChat: (chatId) => {
        openSecondarySidebar("ai-chat");
        void selectAIWorkspaceChat(chatId);
      },
      onSelectFolder: handleSelectFolder,
      onSelectedCountChange: setFileSelectionCount,
      onTogglePin: handleTogglePin,
      openingFilePath,
      openFilePaths: openFilePathSet,
      searchError,
      searchFocusRequest: fileSearchFocusRequest,
      searchFrontmatterCandidates: frontmatterCandidates,
      searchFrontmatterField,
      searchFrontmatterFields: frontmatterSearchFields,
      searchLimitNotice,
      searchMode,
      searchQuery,
      searchResults,
      selectedCountLabel: t("files.selectedCount", { count: fileSelectionCount }),
      sidebarViews,
      sidebarWidth,
      startSidebarResize,
      workspaceState
    },
    language: editorSettings.language,
    overlaysProps: {
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
    railProps: {
      activeChartIds,
      activePanelTabIds,
      activeSidebarView,
      activeWorkspaceId: workspaceState?.activeWorkspace?.id ?? null,
      chartRailViews,
      isSidebarOpen,
      isWorkspaceRenameActive,
      isWorkspaceRenameHoldingRail,
      onChartButton: handleRailChartButton,
      onCloseSidebar: closeSidebar,
      onPanelButton: handleRailPanelButton,
      onRemoveWorkspace: handleRemoveWorkspace,
      onRenameActiveChange: setIsWorkspaceRenameActive,
      onRenameComplete: holdWorkspaceRailAfterRename,
      onRenameWorkspace: handleRenameWorkspace,
      onSetSidebarView: setRailSidebarView,
      onSwitchWorkspace: handleSwitchWorkspace,
      openChartIds,
      openPanelTabIds,
      panelRailViews,
      primaryRailViews,
      registeredWorkspaces,
      removeWorkspaceLabel: (name) => t("files.removeWorkspace", { name }),
      renameLabel: t("files.rename"),
      viewSwitcherLabel: t("nav.viewSwitcher"),
      workspacesLabel: t("files.registeredWorkspaces")
    },
    statusBarProps: {
      activeFileTab: activeFileTabInFocusedPane,
      saveStatus: activeFileTabInFocusedPane ? saveStatusByTabId[activeFileTabInFocusedPane.id] : undefined
    },
    titleBarProps: {
      canOutputPreview: Boolean(activeFileTabInFocusedPane),
      isRightPanelOpen: isEffectiveRightPanelOpen,
      isSourceMode,
      isSplit,
      leftClosingTabIds,
      leftOffsetWidth: titleBarLeftOffsetWidth,
      leftPane,
      onCloseAllTabsInPane: closeAllTabsInPaneWithMotion,
      onCloseOtherTabs: closeOtherTabsWithMotion,
      onCloseTabsToRight: closeTabsToRightWithMotion,
      onDuplicateTabFile: handleDuplicateTabFile,
      onOpenInOtherPane: openFileInOtherPane,
      onPrintPreview: handlePrintPreview,
      onRevealTabFile: handleRevealTabFile,
      onRightPanelViewButton: handleRightPanelViewButton,
      onSavePreviewAsPdf: handleSavePreviewAsPdf,
      onSourceModeToggle: () => setIsSourceMode((value) => !value),
      onSplitToggle: toggleSplitWithMotion,
      onTabClose: closeTabWithMotion,
      onTabMove: moveTab,
      onTabSelect: setTabActive,
      onTogglePinTab: toggleTabPinned,
      renderPanelTabIcon,
      rightClosingTabIds,
      rightPane,
      rightPanelView,
      rightPanelWidth,
      showRightPanelControls: featureRightPanelAvailable,
      tabs
    }
  };
}
