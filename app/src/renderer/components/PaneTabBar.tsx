import type { DragEvent, ReactElement, ReactNode } from "react";

import { paneTabLabel } from "../paneViewModel";
import type { PaneId, PaneState, PanelTabKind, Tab } from "../store/editorStore";
import { useT } from "../i18n";
import type { PaneTabDropTarget } from "../hooks/usePaneTabInteractions";

interface PaneTabBarProps {
  closingTabIds: Set<string>;
  pane: PaneId;
  paneState: PaneState;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  tabDropTarget: PaneTabDropTarget | null;
  tabs: Record<string, Tab>;
  onContextMenuOpen: (tabId: string, x: number, y: number) => void;
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
  pane,
  paneState,
  renderPanelTabIcon,
  tabDropTarget,
  tabs,
  onContextMenuOpen,
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
    </div>
  );
}

function GanttTabIcon(): ReactElement {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}
