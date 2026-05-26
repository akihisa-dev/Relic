import type { CSSProperties, ReactElement, ReactNode } from "react";

import { usePaneTabInteractions } from "../hooks/usePaneTabInteractions";
import { useT } from "../i18n";
import type { PaneId, PaneState, PanelTabKind, Tab } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { PaneTabBar } from "./PaneTabBar";
import { PaneTabContextMenu } from "./PaneTabContextMenu";

interface AppTitleBarProps {
  isRightPanelOpen: boolean;
  isSourceMode: boolean;
  isSplit: boolean;
  leftClosingTabIds: Set<string>;
  leftOffsetWidth: number;
  leftPane: PaneState;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onRevealTabFile?: (tabId: string) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onSourceModeToggle: () => void;
  onSplitToggle: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  rightClosingTabIds: Set<string>;
  rightPane: PaneState;
  rightPanelView: RightPanelView;
  rightPanelWidth: number;
  showRightPanelControls: boolean;
  tabs: Record<string, Tab>;
}

export function AppTitleBar({
  isRightPanelOpen,
  isSourceMode,
  isSplit,
  leftClosingTabIds,
  leftOffsetWidth,
  leftPane,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onDuplicateTabFile,
  onOpenInOtherPane,
  onRevealTabFile,
  onRightPanelViewButton,
  onSourceModeToggle,
  onSplitToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
  renderPanelTabIcon,
  rightClosingTabIds,
  rightPane,
  rightPanelView,
  rightPanelWidth,
  showRightPanelControls,
  tabs
}: AppTitleBarProps): ReactElement {
  const t = useT();
  const style = {
    "--title-bar-action-width": `${isRightPanelOpen ? rightPanelWidth : 136}px`,
    "--title-bar-left-offset": `${leftOffsetWidth}px`
  } as CSSProperties;

  const paneActions = (
    <div className="main-area-actions">
      <button
        aria-label={t("pane.sourceShort")}
        className={`toolbar-btn${isSourceMode ? " active" : ""}`}
        data-tooltip={t("pane.sourceMode")}
        onClick={onSourceModeToggle}
        title={t("pane.sourceMode")}
        type="button"
      >
        <SourceModeIcon />
      </button>
      <button
        aria-label={t("pane.splitShort")}
        className={`toolbar-btn${isSplit ? " active" : ""}`}
        data-tooltip={t("pane.split")}
        onClick={onSplitToggle}
        title={t("pane.split")}
        type="button"
      >
        <SplitViewIcon />
      </button>
      {showRightPanelControls ? (
        <>
          <button
            aria-label={t("pane.outline")}
            className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
            data-tooltip={t("pane.toggleOutline")}
            onClick={() => onRightPanelViewButton("outline")}
            title={t("pane.toggleOutline")}
            type="button"
          >
            <OutlineIcon />
          </button>
          <button
            aria-label={t("pane.links")}
            className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
            data-tooltip={t("pane.toggleLinks")}
            onClick={() => onRightPanelViewButton("links")}
            title={t("pane.toggleLinks")}
            type="button"
          >
            <LinksIcon />
          </button>
        </>
      ) : null}
    </div>
  );

  return (
    <div className={`title-bar${isSplit ? " title-bar--split" : ""}${isRightPanelOpen ? " title-bar--right-panel-open" : ""}`} style={style}>
      <div className="title-bar-drag-area" />
      <div className={`title-bar-pane-tabs${isSplit ? " title-bar-pane-tabs--split" : ""}`}>
        <TitleBarPaneTabs
          closingTabIds={leftClosingTabIds}
          isSplitView={isSplit}
          pane="left"
          paneState={leftPane}
          renderPanelTabIcon={renderPanelTabIcon}
          tabs={tabs}
          onCloseAllTabs={onCloseAllTabsInPane}
          onCloseOtherTabs={onCloseOtherTabs}
          onCloseTabsToRight={onCloseTabsToRight}
          onDuplicateTabFile={onDuplicateTabFile}
          onOpenInOtherPane={onOpenInOtherPane}
          onRevealTabFile={onRevealTabFile}
          onTabClose={onTabClose}
          onTabMove={onTabMove}
          onTabSelect={onTabSelect}
          onTogglePinTab={onTogglePinTab}
        />
        {isSplit ? (
          <TitleBarPaneTabs
            closingTabIds={rightClosingTabIds}
            isSplitView={isSplit}
            pane="right"
            paneState={rightPane}
            renderPanelTabIcon={renderPanelTabIcon}
            tabs={tabs}
            onCloseAllTabs={onCloseAllTabsInPane}
            onCloseOtherTabs={onCloseOtherTabs}
            onCloseTabsToRight={onCloseTabsToRight}
            onDuplicateTabFile={onDuplicateTabFile}
            onOpenInOtherPane={onOpenInOtherPane}
            onRevealTabFile={onRevealTabFile}
            onTabClose={onTabClose}
            onTabMove={onTabMove}
            onTabSelect={onTabSelect}
            onTogglePinTab={onTogglePinTab}
          />
        ) : null}
      </div>
      <div className="title-bar-actions">
        {paneActions}
      </div>
    </div>
  );
}

interface TitleBarPaneTabsProps {
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
  onRevealTabFile?: (tabId: string) => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
}

function TitleBarPaneTabs({
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
  onRevealTabFile,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab
}: TitleBarPaneTabsProps): ReactElement {
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
    <div className={`title-bar-pane title-bar-pane--${pane}`}>
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
        onRevealTabFile={onRevealTabFile}
        onTabClose={(tabId) => onTabClose(pane, tabId)}
        onTogglePinTab={onTogglePinTab}
      />
    </div>
  );
}

function SourceModeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  );
}

function SplitViewIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M12 20v2" />
      <path d="M12 14v2" />
      <path d="M12 8v2" />
      <path d="M12 2v2" />
    </svg>
  );
}

function OutlineIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}

function LinksIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="18">
      <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}
