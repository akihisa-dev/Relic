import type { ReactElement } from "react";

import { markdownLinkForPaneTabPath } from "../paneViewModel";
import type { Tab } from "../store/editorStore";
import { useT } from "../i18n";
import type { PaneTabContextMenuState } from "../hooks/usePaneTabInteractions";

interface PaneTabContextMenuProps {
  contextMenu: PaneTabContextMenuState | null;
  contextTab: Tab | null | undefined;
  isSplitView: boolean;
  isPinned?: boolean;
  onClose: () => void;
  onCloseAllTabs: () => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onOpenInOtherPane: (tabId: string) => void;
  onRevealTabFile?: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
}

export function PaneTabContextMenu({
  contextMenu,
  contextTab,
  isSplitView,
  isPinned,
  onClose,
  onCloseAllTabs,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onDuplicateTabFile,
  onOpenInOtherPane,
  onRevealTabFile,
  onTabClose,
  onTogglePinTab
}: PaneTabContextMenuProps): ReactElement | null {
  const t = useT();

  if (!contextMenu) return null;

  const contextTabIsFile = contextTab?.kind === "file";

  return (
    <div
      className="tab-context-menu"
      onClick={(e) => e.stopPropagation()}
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
    >
      {contextTab ? (
        <>
          {contextTabIsFile && onDuplicateTabFile ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onDuplicateTabFile(contextMenu.tabId);
                onClose();
              }}
              type="button"
            >
              {t("files.duplicate")}
            </button>
          ) : null}
          {contextTabIsFile && onTogglePinTab ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onTogglePinTab(contextMenu.tabId);
                onClose();
              }}
              type="button"
            >
              {isPinned ? t("files.unpin") : t("files.pin")}
            </button>
          ) : null}
          {contextTabIsFile ? (
            <>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  void navigator.clipboard?.writeText(contextTab.path);
                  onClose();
                }}
                type="button"
              >
                {t("files.copyPath")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  void navigator.clipboard?.writeText(markdownLinkForPaneTabPath(contextTab.path));
                  onClose();
                }}
                type="button"
              >
                {t("files.copyMarkdownLink")}
              </button>
            </>
          ) : null}
          {contextTabIsFile && onRevealTabFile ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                onRevealTabFile(contextMenu.tabId);
                onClose();
              }}
              type="button"
            >
              {t("files.revealInFinder")}
            </button>
          ) : null}
          {isSplitView ? (
            <button
              className="tab-context-menu-item"
              onClick={() => { onOpenInOtherPane(contextMenu.tabId); onClose(); }}
              type="button"
            >
              {t("pane.openInOtherPane")}
            </button>
          ) : null}
          <div className="tab-context-menu-separator" />
        </>
      ) : null}
      <button
        className="tab-context-menu-item tab-context-menu-item--icon"
        onClick={() => {
          onTabClose(contextMenu.tabId);
          onClose();
        }}
        type="button"
      >
        <CloseIcon />
        {t("pane.closeTab")}
      </button>
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCloseOtherTabs(contextMenu.tabId);
          onClose();
        }}
        type="button"
      >
        {t("pane.closeOtherTabs")}
      </button>
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCloseTabsToRight(contextMenu.tabId);
          onClose();
        }}
        type="button"
      >
        {t("pane.closeTabsToRight")}
      </button>
      <div className="tab-context-menu-separator" />
      <button
        className="tab-context-menu-item"
        onClick={() => {
          onCloseAllTabs();
          onClose();
        }}
        type="button"
      >
        {t("pane.closeAllTabs")}
      </button>
    </div>
  );
}

function CloseIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="tab-context-menu-icon" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
