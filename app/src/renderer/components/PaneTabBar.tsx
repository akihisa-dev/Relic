import type { DragEvent, ReactElement, ReactNode } from "react";

import { paneTabLabel } from "../paneViewModel";
import type { PaneId, PaneState, PanelTabKind, Tab } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { useT } from "../i18n";
import type { PaneTabDropTarget } from "../hooks/usePaneTabInteractions";

interface PaneTabBarProps {
  closingTabIds: Set<string>;
  isRightPanelOpen: boolean;
  isSourceMode: boolean;
  isSplit: boolean;
  pane: PaneId;
  paneState: PaneState;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  rightPanelView: RightPanelView;
  showControls: boolean;
  showRightPanelControls: boolean;
  tabDropTarget: PaneTabDropTarget | null;
  tabs: Record<string, Tab>;
  onContextMenuOpen: (tabId: string, x: number, y: number) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onSourceModeToggle: () => void;
  onSplitToggle: () => void;
  onTabBarDragLeave: (e: DragEvent<HTMLElement>) => void;
  onTabBarDragOver: (e: DragEvent<HTMLElement>) => void;
  onTabClose: (tabId: string) => void;
  onTabDragEnd: () => void;
  onTabDragOver: (e: DragEvent<HTMLElement>, tabId: string) => void;
  onTabDragStart: (e: DragEvent<HTMLElement>, tabId: string, isClosing: boolean) => void;
  onTabDrop: (e: DragEvent<HTMLElement>, targetTabId?: string | null) => void;
  onTabSelect: (tabId: string) => void;
}

export function PaneTabBar({
  closingTabIds,
  isRightPanelOpen,
  isSourceMode,
  isSplit,
  pane,
  paneState,
  renderPanelTabIcon,
  rightPanelView,
  showControls,
  showRightPanelControls,
  tabDropTarget,
  tabs,
  onContextMenuOpen,
  onRightPanelViewButton,
  onSourceModeToggle,
  onSplitToggle,
  onTabBarDragLeave,
  onTabBarDragOver,
  onTabClose,
  onTabDragEnd,
  onTabDragOver,
  onTabDragStart,
  onTabDrop,
  onTabSelect
}: PaneTabBarProps): ReactElement {
  const t = useT();

  void pane;

  return (
    <div
      className={`pane-tab-bar${tabDropTarget?.tabId === null ? " pane-tab-bar--drop-end" : ""}`}
      onDragLeave={onTabBarDragLeave}
      onDragOver={onTabBarDragOver}
      onDrop={(e) => onTabDrop(e, null)}
    >
      {paneState.tabIds.map((tabId) => {
        const tab = tabs[tabId];
        const isClosing = closingTabIds.has(tabId);

        if (!tab) return null;

        return (
          <div
            className={`pane-tab pane-tab--${tab.kind}${paneState.activeTabId === tabId ? " pane-tab--active" : ""}${isClosing ? " pane-tab--closing" : ""}${tabDropTarget?.tabId === tabId ? ` pane-tab--drop-${tabDropTarget.position}` : ""}`}
            data-tab-id={tabId}
            draggable={!isClosing}
            key={tabId}
            onClick={(e) => {
              e.stopPropagation();
              if (isClosing) return;
              onTabSelect(tabId);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isClosing) return;
              onContextMenuOpen(tabId, e.clientX, e.clientY);
            }}
            onDragOver={(e) => onTabDragOver(e, tabId)}
            onDragStart={(e) => onTabDragStart(e, tabId, isClosing)}
            onDragEnd={onTabDragEnd}
            onDrop={(e) => onTabDrop(e, tabId)}
          >
            {tab.kind === "panel" ? (
              <span className="pane-tab-icon" aria-hidden="true">
                {renderPanelTabIcon(tab.panel)}
              </span>
            ) : tab.kind === "gantt" ? (
              <span className="pane-tab-icon" aria-hidden="true">
                <GanttTabIcon />
              </span>
            ) : null}
            <span className="pane-tab-name">{paneTabLabel(tab, t)}</span>
            <button
              className="pane-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tabId);
              }}
              title={t("pane.closeTab")}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
      {showControls ? (
        <div className="pane-tab-actions">
          <button
            className={`toolbar-btn${isSourceMode ? " active" : ""}`}
            onClick={onSourceModeToggle}
            title={t("pane.sourceMode")}
            type="button"
          >
            {t("pane.sourceShort")}
          </button>
          <button
            className={`toolbar-btn${isSplit ? " active" : ""}`}
            onClick={onSplitToggle}
            title={t("pane.split")}
            type="button"
          >
            {t("pane.splitShort")}
          </button>
          {showRightPanelControls ? (
            <>
              <button
                className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
                onClick={() => onRightPanelViewButton("outline")}
                title={t("pane.toggleOutline")}
                type="button"
              >
                {t("pane.outline")}
              </button>
              <button
                className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
                onClick={() => onRightPanelViewButton("links")}
                title={t("pane.toggleLinks")}
                type="button"
              >
                {t("pane.links")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GanttTabIcon(): ReactElement {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 16 16" width="14">
      <line x1="2" x2="14" y1="4" y2="4" />
      <line x1="2" x2="14" y1="8" y2="8" />
      <line x1="2" x2="14" y1="12" y2="12" />
      <rect height="2.8" rx="1" width="5" x="4" y="2.6" />
      <rect height="2.8" rx="1" width="7" x="7" y="6.6" />
      <rect height="2.8" rx="1" width="4" x="3" y="10.6" />
    </svg>
  );
}
