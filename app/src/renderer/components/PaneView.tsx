import { EditorView } from "@codemirror/view";
import type { MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { useAutoSave } from "../hooks/useAutoSave";
import { usePaneHeadingScroll } from "../hooks/usePaneHeadingScroll";
import { usePaneTabInteractions } from "../hooks/usePaneTabInteractions";
import { useEditorStore, type PaneId, type PanelTabKind } from "../store/editorStore";
import { PaneContentSurface } from "./PaneContentSurface";
import { PaneTabBar } from "./PaneTabBar";
import { PaneTabContextMenu } from "./PaneTabContextMenu";

export interface PaneViewProps {
  actionSlot?: ReactNode;
  allCardPaths: string[];
  closingTabIds: Set<string>;
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  pane: PaneId;
  scrollTargetHeading?: string;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  cardbookPath?: string | null;
  viewRef: MutableRefObject<EditorView | null>;
  renderTimelineTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  onCreateCard: (name: string) => void;
  onEditorAction?: () => void;
  onFocus: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onCardSaved?: (path: string) => void;
  onRenameCard: (path: string, name: string) => void;
  onScrollTargetHandled?: () => void;
  onTabClose: (tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onDuplicateTabCard?: (tabId: string) => void;
  onOpenInOtherPane: (tabId: string) => void;
  onRevealTabCard?: (tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  isSplitView: boolean;
  sourceMode: boolean;
}

export function PaneView({
  actionSlot,
  allCardPaths,
  closingTabIds,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  pane,
  scrollTargetHeading,
  typewriterMode,
  userDefinedFields,
  cardbookPath,
  viewRef,
  renderTimelineTab,
  renderPanelTab,
  renderPanelTabIcon,
  onCreateCard,
  onFocus,
  onOpenLink,
  onOpenWikiLink,
  onCardSaved,
  onRenameCard,
  onScrollTargetHandled,
  onTabClose,
  onTabMove,
  onTabSelect,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onDuplicateTabCard,
  onEditorAction,
  onOpenInOtherPane,
  onRevealTabCard,
  onTogglePinTab,
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
  const contextTabIsPinned = Boolean(contextTab?.isPinned);

  useAutoSave(
    activeTab?.kind === "card" ? activeTab.content : "",
    activeTab?.kind === "card" ? activeTab.path : null,
    activeTab?.kind === "card",
    onCardSaved
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
      <div className={`pane-top-row${actionSlot ? " pane-top-row--with-actions" : ""}`}>
        <PaneTabBar
          closingTabIds={closingTabIds}
          pane={pane}
          paneState={paneState}
          renderPanelTabIcon={renderPanelTabIcon}
          tabDropTarget={tabDropTarget}
          tabs={tabs}
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
        {actionSlot}
      </div>
      <PaneTabContextMenu
        contextMenu={contextMenu}
        contextTab={contextTab}
        isPinned={contextTabIsPinned}
        isSplitView={isSplitView}
        onClose={closeContextMenu}
        onCloseAllTabs={onCloseAllTabs}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseTabsToRight={onCloseTabsToRight}
        onDuplicateTabCard={onDuplicateTabCard}
        onOpenInOtherPane={onOpenInOtherPane}
        onRevealTabCard={onRevealTabCard}
        onTabClose={onTabClose}
        onTogglePinTab={onTogglePinTab}
      />
      <PaneContentSurface
        activeTab={activeTab}
        allCardPaths={allCardPaths}
        editorActionPulse={editorActionPulse}
        editorSettings={editorSettings}
        frontmatterCandidates={frontmatterCandidates}
        renderTimelineTab={renderTimelineTab}
        renderPanelTab={renderPanelTab}
        sourceMode={sourceMode}
        typewriterMode={typewriterMode}
        userDefinedFields={userDefinedFields}
        viewRef={viewRef}
        cardbookPath={cardbookPath}
        onCreateCard={onCreateCard}
        onEditorAction={onEditorAction}
        onOpenLink={onOpenLink}
        onOpenWikiLink={onOpenWikiLink}
        onRenameCard={onRenameCard}
        onUpdateTabContent={updateTabContent}
      />
    </div>
  );
}
