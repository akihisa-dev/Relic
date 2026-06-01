import type { AppLayoutProps } from "./components/AppLayout";
import type { Translator } from "./i18nModel";
import {
  createEditorWorkspaceProps,
  createFilesSidebarProps,
  createOverlaysProps,
  createRailProps,
  createStatusBarProps,
  createTitleBarProps
} from "./appLayoutPropsSections";

type EditorWorkspaceProps = AppLayoutProps["editorWorkspaceProps"];
type FilesSidebarProps = AppLayoutProps["filesSidebarProps"];
type OverlaysProps = AppLayoutProps["overlaysProps"];
type RailProps = AppLayoutProps["railProps"];
type StatusBarProps = AppLayoutProps["statusBarProps"];
type TitleBarProps = AppLayoutProps["titleBarProps"];

export interface AppLayoutPropsInput {
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
  handleRevealWorkspace: RailProps["onRevealWorkspace"];
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

export function createAppLayoutProps(input: AppLayoutPropsInput): AppLayoutProps {
  return {
    editorWorkspaceProps: createEditorWorkspaceProps(input),
    filesSidebarProps: createFilesSidebarProps(input),
    language: input.editorSettings.language,
    overlaysProps: createOverlaysProps(input),
    railProps: createRailProps(input),
    statusBarProps: createStatusBarProps(input),
    titleBarProps: createTitleBarProps(input)
  };
}
