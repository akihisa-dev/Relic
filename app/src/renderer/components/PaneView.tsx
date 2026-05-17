import { EditorView } from "@codemirror/view";
import type { MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { useAutoSave } from "../hooks/useAutoSave";
import { usePaneHeadingScroll } from "../hooks/usePaneHeadingScroll";
import { usePaneTabInteractions } from "../hooks/usePaneTabInteractions";
import { useEditorStore, type PaneId, type PanelTabKind } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { PaneContentSurface } from "./PaneContentSurface";
import { PaneTabBar } from "./PaneTabBar";
import { PaneTabContextMenu } from "./PaneTabContextMenu";

export interface PaneViewProps {
  allFilePaths: string[];
  closingTabIds: Set<string>;
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  isRightPanelOpen: boolean;
  isSplit: boolean;
  pane: PaneId;
  scrollTargetHeading?: string;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
  viewRef: MutableRefObject<EditorView | null>;
  renderGanttChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  onCreateFile: (name: string) => void;
  onEditorAction?: () => void;
  onFocus: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onFileSaved?: (path: string) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onScrollTargetHandled?: () => void;
  onSourceModeToggle: () => void;
  onSplitToggle: () => void;
  onTabClose: (tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onOpenInOtherPane: (tabId: string) => void;
  onRevealTabFile?: (tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  pinnedPaths?: Set<string>;
  rightPanelView: RightPanelView;
  showRightPanelControls: boolean;
  isSplitView: boolean;
  sourceMode: boolean;
}

export function PaneView({
  allFilePaths,
  closingTabIds,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  isRightPanelOpen,
  isSplit,
  pane,
  scrollTargetHeading,
  typewriterMode,
  userDefinedFields,
  workspacePath,
  viewRef,
  renderGanttChartTab,
  renderPanelTab,
  renderPanelTabIcon,
  onCreateFile,
  onFocus,
  onOpenLink,
  onOpenWikiLink,
  onFileSaved,
  onRightPanelViewButton,
  onScrollTargetHandled,
  onSourceModeToggle,
  onSplitToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onDuplicateTabFile,
  onEditorAction,
  onOpenInOtherPane,
  onRevealTabFile,
  onTogglePinTab,
  pinnedPaths,
  rightPanelView,
  showRightPanelControls,
  isSplitView,
  sourceMode
}: PaneViewProps): ReactElement {
  const { leftPane, rightPane, tabs, updateTabContent } = useEditorStore();
  const paneState = pane === "left" ? leftPane : rightPane;
  const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  const {
    closeContextMenu,
    contextMenu,
    handleTabBarDragLeave,
    handleTabBarDragOver,
    handleTabDragEnd,
    handleTabDragOver,
    handleTabDragStart,
    handleTabDrop,
    openContextMenu,
    tabDropTarget
  } = usePaneTabInteractions({ onTabMove, pane });
  const contextTab = contextMenu ? tabs[contextMenu.tabId] : null;
  const contextTabIsPinned = contextTab?.kind === "file" ? pinnedPaths?.has(contextTab.path) : false;

  useAutoSave(
    activeTab?.kind === "file" ? activeTab.content : "",
    activeTab?.kind === "file" ? activeTab.path : null,
    activeTab?.kind === "file",
    onFileSaved
  );

  usePaneHeadingScroll({
    onScrollTargetHandled,
    scrollTargetHeading,
    viewRef
  });

  return (
    <div
      className={`pane${focusedPane === pane ? " pane--focused" : ""}`}
      onClick={onFocus}
      onFocusCapture={onFocus}
      onPointerDownCapture={onFocus}
    >
      <PaneTabBar
        closingTabIds={closingTabIds}
        pane={pane}
        paneState={paneState}
        renderPanelTabIcon={renderPanelTabIcon}
        tabDropTarget={tabDropTarget}
        tabs={tabs}
        showControls={focusedPane === pane}
        isRightPanelOpen={isRightPanelOpen}
        isSourceMode={sourceMode}
        isSplit={isSplit}
        onRightPanelViewButton={onRightPanelViewButton}
        onSourceModeToggle={onSourceModeToggle}
        onSplitToggle={onSplitToggle}
        rightPanelView={rightPanelView}
        showRightPanelControls={showRightPanelControls}
        onContextMenuOpen={openContextMenu}
        onTabBarDragLeave={handleTabBarDragLeave}
        onTabBarDragOver={handleTabBarDragOver}
        onTabClose={onTabClose}
        onTabDragEnd={handleTabDragEnd}
        onTabDragOver={handleTabDragOver}
        onTabDragStart={handleTabDragStart}
        onTabDrop={handleTabDrop}
        onTabSelect={onTabSelect}
      />
      <PaneTabContextMenu
        contextMenu={contextMenu}
        contextTab={contextTab}
        isPinned={contextTabIsPinned}
        isSplitView={isSplitView}
        onClose={closeContextMenu}
        onCloseAllTabs={onCloseAllTabs}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseTabsToRight={onCloseTabsToRight}
        onDuplicateTabFile={onDuplicateTabFile}
        onOpenInOtherPane={onOpenInOtherPane}
        onRevealTabFile={onRevealTabFile}
        onTabClose={onTabClose}
        onTabSelect={onTabSelect}
        onTogglePinTab={onTogglePinTab}
      />
      <PaneContentSurface
        activeTab={activeTab}
        allFilePaths={allFilePaths}
        editorActionPulse={editorActionPulse}
        editorSettings={editorSettings}
        frontmatterCandidates={frontmatterCandidates}
        renderGanttChartTab={renderGanttChartTab}
        renderPanelTab={renderPanelTab}
        sourceMode={sourceMode}
        typewriterMode={typewriterMode}
        userDefinedFields={userDefinedFields}
        viewRef={viewRef}
        workspacePath={workspacePath}
        onCreateFile={onCreateFile}
        onEditorAction={onEditorAction}
        onOpenLink={onOpenLink}
        onOpenWikiLink={onOpenWikiLink}
        onUpdateTabContent={updateTabContent}
      />
    </div>
  );
}
