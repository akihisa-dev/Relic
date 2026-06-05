import type { ReactElement, ReactNode } from "react";

import { usePaneTabInteractions } from "../hooks/usePaneTabInteractions";
import type { FileTab, PaneId, PaneState, PanelTabKind, Tab } from "../store/editorStore";
import { PaneTabBar } from "./PaneTabBar";
import { PaneTabContextMenu } from "./PaneTabContextMenu";

interface PaneTabsProps {
  closingTabIds: Set<string>;
  isSplitView: boolean;
  pane: PaneId;
  paneState: PaneState;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  tabs: Record<string, Tab>;
  onCloseAllTabs: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onPrintPreview: (tab: FileTab) => void;
  onRevealTabFile?: (tabId: string) => void;
  onSavePreviewAsPdf: (tab: FileTab) => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
}

export function PaneTabs({
  closingTabIds,
  isSplitView,
  pane,
  paneState,
  renderPanelTabIcon,
  tabs,
  onCloseAllTabs,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onDuplicateTabFile,
  onOpenInOtherPane,
  onPrintPreview,
  onRevealTabFile,
  onSavePreviewAsPdf,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab
}: PaneTabsProps): ReactElement {
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

  return (
    <div className={`pane-tabs pane-tabs--${pane}`}>
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
        onTabClose={(tabId) => onTabClose(pane, tabId)}
        onTabDragEnd={handleTabDragEnd}
        onTabDragOver={handleTabDragOver}
        onTabDragStart={handleTabDragStart}
        onTabDrop={handleTabDrop}
        onTabSelect={(tabId) => onTabSelect(pane, tabId)}
      />
      <PaneTabContextMenu
        contextMenu={contextMenu}
        contextTab={contextTab}
        isPinned={contextTabIsPinned}
        isSplitView={isSplitView}
        onClose={closeContextMenu}
        onCloseAllTabs={() => onCloseAllTabs(pane)}
        onCloseOtherTabs={(tabId) => onCloseOtherTabs(pane, tabId)}
        onCloseTabsToRight={(tabId) => onCloseTabsToRight(pane, tabId)}
        onDuplicateTabFile={onDuplicateTabFile}
        onOpenInOtherPane={(tabId) => onOpenInOtherPane(pane, tabId)}
        onPrintPreview={onPrintPreview}
        onRevealTabFile={onRevealTabFile}
        onSavePreviewAsPdf={onSavePreviewAsPdf}
        onTabClose={(tabId) => onTabClose(pane, tabId)}
        onTogglePinTab={onTogglePinTab}
      />
    </div>
  );
}
