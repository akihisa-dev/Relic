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

export interface AppLayoutPropsInput {
  activeChartIds: RailProps["activeChartIds"];
  activeFileTabInFocusedPane: StatusBarProps["activeFileTab"];
  activeFileTabForRightPanel: EditorWorkspaceProps["activeFileTab"];
  activePanelTabIds: RailProps["activePanelTabIds"];
  activeSidebarView: RailProps["activeSidebarView"];
  aliasesByPath: OverlaysProps["aliasesByPath"];
  appInlineHandlers: Pick<
    EditorWorkspaceProps,
    "onEditorAction" | "onOutlineHeadingClick" | "onScrollTargetHandled"
  >;
  backlinks: EditorWorkspaceProps["backlinks"];
  chartRailViews: RailProps["chartRailViews"];
  closeAllTabsInPaneWithMotion: EditorWorkspaceProps["onCloseAllTabsInPane"];
  closeOtherTabsWithMotion: EditorWorkspaceProps["onCloseOtherTabs"];
  closeSidebar: FilesSidebarProps["onCloseSidebar"];
  closeTabWithMotion: EditorWorkspaceProps["onTabClose"];
  closeTabsToRightWithMotion: EditorWorkspaceProps["onCloseTabsToRight"];
  closeToast: OverlaysProps["closeToast"];
  commands: OverlaysProps["commands"];
  editorActionPulse: EditorWorkspaceProps["editorActionPulse"];
  editorSettings: EditorWorkspaceProps["editorSettings"];
  existingMarkdownPaths: EditorWorkspaceProps["allFilePaths"];
  featureRightPanelLinksAvailable: EditorWorkspaceProps["showRightPanelLinksControl"];
  featureRightPanelOutlineAvailable: EditorWorkspaceProps["showRightPanelOutlineControl"];
  featureRightPanelFrontmatterAvailable: EditorWorkspaceProps["showRightPanelFrontmatterControl"];
  fileSearchFocusRequest: FilesSidebarProps["searchFocusRequest"];
  fileSelectionCount: FilesSidebarProps["fileSelectionCount"];
  focusedPane: EditorWorkspaceProps["focusedPane"];
  frontmatterCandidates: EditorWorkspaceProps["frontmatterCandidates"];
  frontmatterSearchFields: FilesSidebarProps["searchFrontmatterFields"];
  handleCreateFileFromSidebar: FilesSidebarProps["onCreateFile"];
  handleCreateFileInFolder: FilesSidebarProps["onCreateFileInFolder"];
  handleCreateFolderFromSidebar: FilesSidebarProps["onCreateFolder"];
  handleCreateFolderInFolder: FilesSidebarProps["onCreateFolderInFolder"];
  handleCreateDiagramFile: FilesSidebarProps["onCreateDiagramFile"];
  handleCreateNewWorkspace: FilesSidebarProps["onCreateWorkspace"];
  handleCreateNoteFromPane: EditorWorkspaceProps["onCreateFile"];
  handleDeleteTreeItem: FilesSidebarProps["onDeleteItem"];
  handleDeleteTreeItems: FilesSidebarProps["onDeleteItems"];
  handleDuplicateTabFile: EditorWorkspaceProps["onDuplicateTabFile"];
  handleDuplicateTreeFile: FilesSidebarProps["onDuplicateFile"];
  handleFileSaved: EditorWorkspaceProps["onFileSaved"];
  handleLargeMarkdownFallback: EditorWorkspaceProps["onLargeMarkdownFallback"];
  handleMoveFile: FilesSidebarProps["onMoveFile"];
  handleMoveFolder: FilesSidebarProps["onMoveFolder"];
  handleMoveTreeItems: FilesSidebarProps["onMoveItems"];
  handleOpenFile: EditorWorkspaceProps["onOpenFile"];
  handleOpenMarkdownLink: EditorWorkspaceProps["onOpenLink"];
  handleOpenWikiLink: EditorWorkspaceProps["onOpenWikiLink"];
  handleOpenWorkspace: FilesSidebarProps["onOpenWorkspace"];
  handlePrintPreview: EditorWorkspaceProps["onPrintPreview"];
  handleRailChartButton: RailProps["onChartButton"];
  handleRailPanelButton: RailProps["onPanelButton"];
  handleRemoveWorkspace: RailProps["onRemoveWorkspace"];
  handleRenameTreeItem: FilesSidebarProps["onRenameItem"];
  handleRenameWorkspace: RailProps["onRenameWorkspace"];
  handleRevealWorkspace: RailProps["onRevealWorkspace"];
  handleRevealTabFile: EditorWorkspaceProps["onRevealTabFile"];
  handleRevealWorkspaceItem: OverlaysProps["handleRevealWorkspaceItem"];
  handleRightPanelViewButton: EditorWorkspaceProps["onRightPanelViewButton"];
  handleSavePreviewAsPdf: EditorWorkspaceProps["onSavePreviewAsPdf"];
  handleSelectFolder: FilesSidebarProps["onSelectFolder"];
  handleSidebarOpenFile: FilesSidebarProps["onOpenFile"];
  handleSwitchWorkspace: RailProps["onSwitchWorkspace"];
  handleTogglePin: FilesSidebarProps["onTogglePin"];
  holdWorkspaceRailAfterRename: RailProps["onRenameComplete"];
  isCreatingFile: FilesSidebarProps["isCreatingFile"];
  isCreatingFolder: FilesSidebarProps["isCreatingFolder"];
  isCreatingWorkspace: FilesSidebarProps["isCreatingWorkspace"];
  isEffectiveRightPanelOpen: EditorWorkspaceProps["isRightPanelOpen"];
  isLoadingBacklinks: EditorWorkspaceProps["isLoadingBacklinks"];
  isOpeningWorkspace: FilesSidebarProps["isOpeningWorkspace"];
  isRightPanelResizing: EditorWorkspaceProps["isRightPanelResizing"];
  isSearching: FilesSidebarProps["isSearching"];
  isSidebarOpen: RailProps["isSidebarOpen"];
  isSidebarResizing: FilesSidebarProps["isSidebarResizing"];
  isLeftSourceMode: EditorWorkspaceProps["isLeftSourceMode"];
  isRightSourceMode: EditorWorkspaceProps["isRightSourceMode"];
  isSplit: EditorWorkspaceProps["isSplit"];
  isSplitClosing: EditorWorkspaceProps["isSplitClosing"];
  isToastClosing: OverlaysProps["isToastClosing"];
  isTypewriterMode: EditorWorkspaceProps["isTypewriterMode"];
  isWorkspaceRenameActive: RailProps["isWorkspaceRenameActive"];
  isWorkspaceRenameHoldingRail: RailProps["isWorkspaceRenameHoldingRail"];
  leftClosingTabIds: EditorWorkspaceProps["leftClosingTabIds"];
  leftEditorViewRef: EditorWorkspaceProps["leftEditorViewRef"];
  leftPaneScrollHeading: EditorWorkspaceProps["leftPaneScrollHeading"];
  linkContextMenu: OverlaysProps["linkContextMenu"];
  moveTab: EditorWorkspaceProps["onTabMove"];
  openChartIds: RailProps["openChartIds"];
  openFileInOtherPane: EditorWorkspaceProps["onOpenInOtherPane"];
  openFilePathSet: FilesSidebarProps["openFilePaths"];
  openPanelTabIds: RailProps["openPanelTabIds"];
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
  renderPanelTabIcon: EditorWorkspaceProps["renderPanelTabIcon"];
  rightClosingTabIds: EditorWorkspaceProps["rightClosingTabIds"];
  rightEditorViewRef: EditorWorkspaceProps["rightEditorViewRef"];
  rightPaneScrollHeading: EditorWorkspaceProps["rightPaneScrollHeading"];
  rightPanelView: EditorWorkspaceProps["rightPanelView"];
  rightPanelWidth: EditorWorkspaceProps["rightPanelWidth"];
  saveStatusByTabId: Record<string, StatusBarProps["saveStatus"]>;
  searchError: FilesSidebarProps["searchError"];
  searchFrontmatterField: FilesSidebarProps["searchFrontmatterField"];
  searchLimitNotice: FilesSidebarProps["searchLimitNotice"];
  searchMode: FilesSidebarProps["searchMode"];
  searchQuery: FilesSidebarProps["searchQuery"];
  searchResults: FilesSidebarProps["searchResults"];
  setFileSelectionCount: FilesSidebarProps["onSelectedCountChange"];
  setIsLeftSourceMode: (updater: (value: boolean) => boolean) => void;
  setIsRightSourceMode: (updater: (value: boolean) => boolean) => void;
  setIsWorkspaceRenameActive: RailProps["onRenameActiveChange"];
  setLinkContextMenu: OverlaysProps["setLinkContextMenu"];
  setFocusedPane: EditorWorkspaceProps["onSetFocusedPane"];
  setRailSidebarView: RailProps["onSetSidebarView"];
  setSearchFrontmatterField: FilesSidebarProps["onSearchFrontmatterFieldChange"];
  setSearchMode: FilesSidebarProps["onSearchModeChange"];
  setSearchQuery: FilesSidebarProps["onSearchQueryChange"];
  setShowCommandPalette: OverlaysProps["setShowCommandPalette"];
  setShowQuickSwitcher: OverlaysProps["setShowQuickSwitcher"];
  setTabActive: EditorWorkspaceProps["onTabSelect"];
  updateTabContent: EditorWorkspaceProps["onUpdateTabContent"];
  setWorkspaceError: EditorWorkspaceProps["onFileSaveError"];
  showCommandPalette: OverlaysProps["showCommandPalette"];
  showQuickSwitcher: OverlaysProps["showQuickSwitcher"];
  sidebarCreateFlight: OverlaysProps["sidebarCreateFlight"];
  sidebarViews: FilesSidebarProps["sidebarViews"];
  sidebarWidth: FilesSidebarProps["sidebarWidth"];
  startRightPanelResize: EditorWorkspaceProps["onRightPanelResizeStart"];
  startSidebarResize: FilesSidebarProps["startSidebarResize"];
  t: Translator;
  toastMessage: OverlaysProps["toastMessage"];
  toggleSplitWithMotion: EditorWorkspaceProps["onSplitToggle"];
  toggleTabPinned: EditorWorkspaceProps["onTogglePinTab"];
  userDefinedFields: EditorWorkspaceProps["userDefinedFields"];
  workspaceState: FilesSidebarProps["workspaceState"];
}

export function createAppLayoutProps(input: AppLayoutPropsInput): AppLayoutProps {
  return {
    editorWorkspaceProps: createEditorWorkspaceProps(input),
    filesSidebarProps: createFilesSidebarProps(input),
    font: input.editorSettings.font,
    language: input.editorSettings.language,
    overlaysProps: createOverlaysProps(input),
    railProps: createRailProps(input),
    statusBarProps: createStatusBarProps(input),
    titleBarProps: createTitleBarProps(input)
  };
}
