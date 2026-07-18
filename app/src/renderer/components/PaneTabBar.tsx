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
  const hasTabs = paneState.tabIds.length > 0;

  void pane;

  return (
    <div className={`pane-tab-bar-shell${hasTabs ? " pane-tab-bar-shell--has-tabs" : " pane-tab-bar-shell--empty"}`}>
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

          const tabName = paneTabLabel(tab, t);
          const tabNameExtension = tab.kind === "file" && /\.md$/i.test(tab.path) && !/\.md$/i.test(tabName)
            ? ".md"
            : undefined;

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
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                if (isClosing) return;
                onTabSelect(tabId);
              }}
              role="tab"
              tabIndex={0}
            >
              {tab.isPinned ? (
                <span className="pane-tab-icon pane-tab-pin-icon" aria-hidden="true" data-testid="pane-tab-pin-icon">
                  <PinTabIcon />
                </span>
              ) : null}
              {tab.kind === "panel" ? (
                <span className="pane-tab-icon" aria-hidden="true">
                  {renderPanelTabIcon(tab.panel)}
                </span>
              ) : tab.kind === "chart" ? (
                <span className="pane-tab-icon" aria-hidden="true">
                  <ChartTabIcon />
                </span>
              ) : tab.kind === "image" ? (
                <span className="pane-tab-icon" aria-hidden="true">
                  <ImageTabIcon />
                </span>
              ) : tab.kind === "pdf" ? (
                <span className="pane-tab-icon" aria-hidden="true">
                  <PdfTabIcon />
                </span>
              ) : null}
              {tab.kind === "file" && tab.content !== tab.savedContent ? (
                <span className="pane-tab-dirty-dot" aria-hidden="true" />
              ) : null}
              <span className="pane-tab-name" data-extension={tabNameExtension}>{tabName}</span>
              <button
                aria-label={t("pane.closeTab")}
                className="pane-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tabId);
                }}
                type="button"
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CloseIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20">
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function PinTabIcon(): ReactElement {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function ChartTabIcon(): ReactElement {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <rect height="4" rx="1" width="9" x="7" y="13" />
      <rect height="4" rx="1" width="12" x="7" y="5" />
    </svg>
  );
}

function ImageTabIcon(): ReactElement {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <rect height="18" rx="2" width="18" x="3" y="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function PdfTabIcon(): ReactElement {
  return (
    <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.7.7l3.6 3.6A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2Z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M7.5 17h1.2a1.3 1.3 0 0 0 0-2.6H7.5v4.1" />
      <path d="M12 18.5v-4.1h1a2 2 0 0 1 0 4.1Z" />
      <path d="M16.4 18.5v-4.1h2.1" />
      <path d="M16.4 16.4h1.6" />
    </svg>
  );
}
