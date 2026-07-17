import type { ReactElement } from "react";
import { createPortal } from "react-dom";

import { writeEditorClipboardText } from "../editorClipboard";
import { markdownLinkForPaneTabPath } from "../paneViewModel";
import type { FileTab, Tab } from "../store/editorStore";
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
  onSavePreviewAsPdf: (tab: FileTab) => void;
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
  onSavePreviewAsPdf,
  onTabClose,
  onTogglePinTab
}: PaneTabContextMenuProps): ReactElement | null {
  const t = useT();

  if (!contextMenu) return null;

  const contextTabIsFile = contextTab?.kind === "file";

  return createPortal(
    <div
      className="tab-context-menu"
      onClick={(e) => e.stopPropagation()}
      role="menu"
      style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 10000 }}
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
          {onTogglePinTab ? (
            <button
              className="tab-context-menu-item tab-context-menu-item--icon"
              onClick={() => {
                onTogglePinTab(contextMenu.tabId);
                onClose();
              }}
              type="button"
            >
              {isPinned ? <PinOffIcon /> : <PinIcon />}
              {isPinned ? t("files.unpin") : t("files.pin")}
            </button>
          ) : null}
          {contextTabIsFile ? (
            <>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  void writeEditorClipboardText(contextTab.path).catch(() => undefined);
                  onClose();
                }}
                type="button"
              >
                {t("files.copyPath")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  void writeEditorClipboardText(markdownLinkForPaneTabPath(contextTab.path)).catch(() => undefined);
                  onClose();
                }}
                type="button"
              >
                {t("files.copyMarkdownLink")}
              </button>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onSavePreviewAsPdf(contextTab);
                  onClose();
                }}
                type="button"
              >
                {t("output.savePdf")}
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
        className="tab-context-menu-item"
        onClick={() => {
          onTabClose(contextMenu.tabId);
          onClose();
        }}
        type="button"
      >
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
    </div>,
    document.body
  );
}

function PinIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="tab-context-menu-icon" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

function PinOffIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="tab-context-menu-icon" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
      <path d="M12 17v5" />
      <path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89" />
      <path d="m2 2 20 20" />
      <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11" />
    </svg>
  );
}
