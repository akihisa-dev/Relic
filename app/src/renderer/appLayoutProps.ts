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
  editorWorkspace: AppLayoutEditorWorkspaceInput;
  filesSidebar: AppLayoutFilesSidebarInput;
  overlays: AppLayoutOverlaysInput;
  rail: AppLayoutRailInput;
  shell: AppLayoutShellInput;
  statusBar: AppLayoutStatusBarInput;
}

export interface AppLayoutShellInput {
  editorSettings: EditorWorkspaceProps["editorSettings"];
}

export interface AppLayoutEditorWorkspaceInput {
  activeFileTab: EditorWorkspaceProps["activeFileTab"];
  allFilePaths: EditorWorkspaceProps["allFilePaths"];
  appInlineHandlers: Pick<
    EditorWorkspaceProps,
    "onEditorAction" | "onOutlineHeadingClick" | "onScrollTargetHandled"
  >;
  backlinks: EditorWorkspaceProps["backlinks"];
  closeAllTabsInPaneWithMotion: EditorWorkspaceProps["onCloseAllTabsInPane"];
  closeOtherTabsWithMotion: EditorWorkspaceProps["onCloseOtherTabs"];
  closeTabWithMotion: EditorWorkspaceProps["onTabClose"];
  closeTabsToRightWithMotion: EditorWorkspaceProps["onCloseTabsToRight"];
  editorActionPulse: EditorWorkspaceProps["editorActionPulse"];
  editorSettings: EditorWorkspaceProps["editorSettings"];
  focusedPane: EditorWorkspaceProps["focusedPane"];
  frontmatterCandidates: EditorWorkspaceProps["frontmatterCandidates"];
  handleCreateNoteFromPane: EditorWorkspaceProps["onCreateFile"];
  handleDuplicateTabFile: EditorWorkspaceProps["onDuplicateTabFile"];
  handleFileSaved: EditorWorkspaceProps["onFileSaved"];
  handleLargeMarkdownFallback: EditorWorkspaceProps["onLargeMarkdownFallback"];
  handleOpenFile: EditorWorkspaceProps["onOpenFile"];
  handleOpenMarkdownLink: EditorWorkspaceProps["onOpenLink"];
  handleOpenWikiLink: EditorWorkspaceProps["onOpenWikiLink"];
  handleRenameTreeItem: FilesSidebarProps["onRenameItem"];
  handleRevealTabFile: EditorWorkspaceProps["onRevealTabFile"];
  handleRightPanelViewButton: EditorWorkspaceProps["onRightPanelViewButton"];
  handleSavePreviewAsPdf: EditorWorkspaceProps["onSavePreviewAsPdf"];
  isEffectiveRightPanelOpen: EditorWorkspaceProps["isRightPanelOpen"];
  isLoadingBacklinks: EditorWorkspaceProps["isLoadingBacklinks"];
  isRightPanelResizing: EditorWorkspaceProps["isRightPanelResizing"];
  isLeftSourceMode: EditorWorkspaceProps["isLeftSourceMode"];
  isRightSourceMode: EditorWorkspaceProps["isRightSourceMode"];
  isSplit: EditorWorkspaceProps["isSplit"];
  isSplitClosing: EditorWorkspaceProps["isSplitClosing"];
  isTypewriterMode: EditorWorkspaceProps["isTypewriterMode"];
  leftClosingTabIds: EditorWorkspaceProps["leftClosingTabIds"];
  leftEditorViewRef: EditorWorkspaceProps["leftEditorViewRef"];
  leftPaneScrollHeading: EditorWorkspaceProps["leftPaneScrollHeading"];
  moveTab: EditorWorkspaceProps["onTabMove"];
  openFileInOtherPane: EditorWorkspaceProps["onOpenInOtherPane"];
  outlineHeadings: EditorWorkspaceProps["outlineHeadings"];
  outgoingLinks: EditorWorkspaceProps["outgoingLinks"];
  outgoingLinksLimited: EditorWorkspaceProps["outgoingLinksLimited"];
  renderChartTab: EditorWorkspaceProps["renderChartTab"];
  renderPanelTab: EditorWorkspaceProps["renderPanelTab"];
  renderPanelTabIcon: EditorWorkspaceProps["renderPanelTabIcon"];
  rightClosingTabIds: EditorWorkspaceProps["rightClosingTabIds"];
  rightEditorViewRef: EditorWorkspaceProps["rightEditorViewRef"];
  rightPaneScrollHeading: EditorWorkspaceProps["rightPaneScrollHeading"];
  rightPanelView: EditorWorkspaceProps["rightPanelView"];
  rightPanelWidth: EditorWorkspaceProps["rightPanelWidth"];
  setFocusedPane: EditorWorkspaceProps["onSetFocusedPane"];
  setIsLeftSourceMode: (updater: (value: boolean) => boolean) => void;
  setIsRightSourceMode: (updater: (value: boolean) => boolean) => void;
  setLinkContextMenu: EditorWorkspaceProps["setLinkContextMenu"];
  setTabActive: EditorWorkspaceProps["onTabSelect"];
  setWorkspaceError: EditorWorkspaceProps["onFileSaveError"];
  showRightPanelLinksControl: EditorWorkspaceProps["showRightPanelLinksControl"];
  showRightPanelOutlineControl: EditorWorkspaceProps["showRightPanelOutlineControl"];
  showRightPanelFrontmatterControl: EditorWorkspaceProps["showRightPanelFrontmatterControl"];
  startRightPanelResize: EditorWorkspaceProps["onRightPanelResizeStart"];
  toggleSplitWithMotion: EditorWorkspaceProps["onSplitToggle"];
  toggleTabPinned: EditorWorkspaceProps["onTogglePinTab"];
  updateTabContent: EditorWorkspaceProps["onUpdateTabContent"];
  userDefinedFields: EditorWorkspaceProps["userDefinedFields"];
  workspaceState: FilesSidebarProps["workspaceState"];
}

export interface AppLayoutFilesSidebarInput {
  activeSidebarView: FilesSidebarProps["activeSidebarView"];
  closeSidebar: FilesSidebarProps["onCloseSidebar"];
  fileSearchFocusRequest: FilesSidebarProps["searchFocusRequest"];
  fileSelectionCount: FilesSidebarProps["fileSelectionCount"];
  frontmatterCandidates: FilesSidebarProps["searchFrontmatterCandidates"];
  frontmatterSearchFields: FilesSidebarProps["searchFrontmatterFields"];
  handleCreateFileFromSidebar: FilesSidebarProps["onCreateFile"];
  handleCreateFileInFolder: FilesSidebarProps["onCreateFileInFolder"];
  handleCreateFolderFromSidebar: FilesSidebarProps["onCreateFolder"];
  handleCreateFolderInFolder: FilesSidebarProps["onCreateFolderInFolder"];
  handleCreateNewWorkspace: FilesSidebarProps["onCreateWorkspace"];
  handleDeleteTreeItem: FilesSidebarProps["onDeleteItem"];
  handleDeleteTreeItems: FilesSidebarProps["onDeleteItems"];
  handleDuplicateTreeFile: FilesSidebarProps["onDuplicateFile"];
  handleImportMarkdownFiles: FilesSidebarProps["onImportMarkdownFiles"];
  handleMoveFile: FilesSidebarProps["onMoveFile"];
  handleMoveFolder: FilesSidebarProps["onMoveFolder"];
  handleMoveTreeItems: FilesSidebarProps["onMoveItems"];
  handleOpenWorkspace: FilesSidebarProps["onOpenWorkspace"];
  handleRenameTreeItem: FilesSidebarProps["onRenameItem"];
  handleRevealWorkspaceItem: FilesSidebarProps["onRevealItem"];
  handleSelectFolder: FilesSidebarProps["onSelectFolder"];
  handleSidebarOpenFile: FilesSidebarProps["onOpenFile"];
  handleTogglePin: FilesSidebarProps["onTogglePin"];
  isCreatingFile: FilesSidebarProps["isCreatingFile"];
  isCreatingFolder: FilesSidebarProps["isCreatingFolder"];
  isCreatingWorkspace: FilesSidebarProps["isCreatingWorkspace"];
  isOpeningWorkspace: FilesSidebarProps["isOpeningWorkspace"];
  isSearching: FilesSidebarProps["isSearching"];
  isSidebarOpen: FilesSidebarProps["isSidebarOpen"];
  isSidebarResizing: FilesSidebarProps["isSidebarResizing"];
  isSplit: EditorWorkspaceProps["isSplit"];
  openFilePathSet: FilesSidebarProps["openFilePaths"];
  openingFilePath: FilesSidebarProps["openingFilePath"];
  openTreeFileInOtherPane: FilesSidebarProps["onOpenInOtherPane"];
  searchError: FilesSidebarProps["searchError"];
  searchFrontmatterField: FilesSidebarProps["searchFrontmatterField"];
  searchLimitNotice: FilesSidebarProps["searchLimitNotice"];
  searchMode: FilesSidebarProps["searchMode"];
  searchQuery: FilesSidebarProps["searchQuery"];
  searchResults: FilesSidebarProps["searchResults"];
  setFileSelectionCount: FilesSidebarProps["onSelectedCountChange"];
  setSearchFrontmatterField: FilesSidebarProps["onSearchFrontmatterFieldChange"];
  setSearchMode: FilesSidebarProps["onSearchModeChange"];
  setSearchQuery: FilesSidebarProps["onSearchQueryChange"];
  sidebarViews: FilesSidebarProps["sidebarViews"];
  sidebarWidth: FilesSidebarProps["sidebarWidth"];
  startSidebarResize: FilesSidebarProps["startSidebarResize"];
  t: Translator;
  workspaceState: FilesSidebarProps["workspaceState"];
}

export interface AppLayoutOverlaysInput {
  aliasesByPath: OverlaysProps["aliasesByPath"];
  closeToast: OverlaysProps["closeToast"];
  commands: OverlaysProps["commands"];
  existingMarkdownPaths: EditorWorkspaceProps["allFilePaths"];
  handleRevealWorkspaceItem: OverlaysProps["handleRevealWorkspaceItem"];
  isSplit: EditorWorkspaceProps["isSplit"];
  isToastClosing: OverlaysProps["isToastClosing"];
  linkContextMenu: OverlaysProps["linkContextMenu"];
  handleOpenFile: OverlaysProps["handleOpenFile"];
  handleOpenWikiLink: OverlaysProps["handleOpenWikiLink"];
  openWorkspacePathInOtherPane: OverlaysProps["openWorkspacePathInOtherPane"];
  railTabFlight: OverlaysProps["railTabFlight"];
  setLinkContextMenu: OverlaysProps["setLinkContextMenu"];
  setShowCommandPalette: OverlaysProps["setShowCommandPalette"];
  setShowQuickSwitcher: OverlaysProps["setShowQuickSwitcher"];
  showCommandPalette: OverlaysProps["showCommandPalette"];
  showQuickSwitcher: OverlaysProps["showQuickSwitcher"];
  sidebarCreateFlight: OverlaysProps["sidebarCreateFlight"];
  toastMessage: OverlaysProps["toastMessage"];
}

export interface AppLayoutRailInput {
  activeChartIds: RailProps["activeChartIds"];
  activePanelTabIds: RailProps["activePanelTabIds"];
  activeSidebarView: RailProps["activeSidebarView"];
  chartRailViews: RailProps["chartRailViews"];
  closeSidebar: RailProps["onCloseSidebar"];
  handleRailChartButton: RailProps["onChartButton"];
  handleRailPanelButton: RailProps["onPanelButton"];
  handleRemoveWorkspace: RailProps["onRemoveWorkspace"];
  handleRenameWorkspace: RailProps["onRenameWorkspace"];
  handleRevealWorkspace: RailProps["onRevealWorkspace"];
  handleSwitchWorkspace: RailProps["onSwitchWorkspace"];
  holdWorkspaceRailAfterRename: RailProps["onRenameComplete"];
  isSidebarOpen: RailProps["isSidebarOpen"];
  isWorkspaceRenameActive: RailProps["isWorkspaceRenameActive"];
  isWorkspaceRenameHoldingRail: RailProps["isWorkspaceRenameHoldingRail"];
  openChartIds: RailProps["openChartIds"];
  openPanelTabIds: RailProps["openPanelTabIds"];
  panelRailViews: RailProps["panelRailViews"];
  primaryRailViews: RailProps["primaryRailViews"];
  registeredWorkspaces: RailProps["registeredWorkspaces"];
  setIsWorkspaceRenameActive: RailProps["onRenameActiveChange"];
  setRailSidebarView: RailProps["onSetSidebarView"];
  t: Translator;
  workspaceState: FilesSidebarProps["workspaceState"];
}

export interface AppLayoutStatusBarInput {
  activeFileTab: StatusBarProps["activeFileTab"];
  saveStatusByTabId: Record<string, StatusBarProps["saveStatus"]>;
}

export function createAppLayoutProps(input: AppLayoutPropsInput): AppLayoutProps {
  return {
    editorWorkspaceProps: createEditorWorkspaceProps(input.editorWorkspace),
    filesSidebarProps: createFilesSidebarProps(input.filesSidebar),
    font: input.shell.editorSettings.font,
    language: input.shell.editorSettings.language,
    overlaysProps: createOverlaysProps(input.overlays),
    railProps: createRailProps(input.rail),
    statusBarProps: createStatusBarProps(input.statusBar),
    titleBarProps: createTitleBarProps(input)
  };
}
