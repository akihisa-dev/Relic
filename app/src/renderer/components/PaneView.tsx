import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import type { MutableRefObject, ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";
import { useT } from "../i18n";
import { useEditorStore, type PaneId } from "../store/editorStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { Editor } from "./Editor";

export interface PaneViewProps {
  allFilePaths: string[];
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  pane: PaneId;
  scrollTargetHeading?: string;
  typewriterMode: boolean;
  workspacePath?: string | null;
  viewRef: MutableRefObject<EditorView | null>;
  onCreateFile: (name: string) => void;
  onFocus: () => void;
  onScrollTargetHandled?: () => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onOpenInOtherPane: (tabId: string) => void;
  isSplitView: boolean;
}

export function PaneView({
  allFilePaths,
  editorSettings,
  focusedPane,
  pane,
  scrollTargetHeading,
  typewriterMode,
  workspacePath,
  viewRef,
  onCreateFile,
  onFocus,
  onScrollTargetHandled,
  onTabClose,
  onTabSelect,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onOpenInOtherPane,
  isSplitView
}: PaneViewProps): ReactElement {
  const [newFileName, setNewFileName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const { leftPane, rightPane, tabs, updateTabContent } = useEditorStore();
  const paneState = pane === "left" ? leftPane : rightPane;
  const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  const t = useT();

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  useAutoSave(activeTab?.content ?? "", activeTab?.path ?? null, activeTab !== null);

  useEffect(() => {
    if (!scrollTargetHeading || !viewRef.current) return;
    const view = viewRef.current;
    const doc = view.state.doc;
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (/^#{1,6} /.test(line.text) && line.text.replace(/^#{1,6} /, "") === scrollTargetHeading) {
        view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
        break;
      }
    }
    onScrollTargetHandled?.();
  }, [scrollTargetHeading, onScrollTargetHandled]);

  const charCount = activeTab?.content.length ?? 0;
  const wordCount = activeTab
    ? activeTab.content.split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div
      className={`pane${focusedPane === pane ? " pane--focused" : ""}`}
      onClick={onFocus}
    >
      <div className="pane-tab-bar">
        {paneState.tabIds.map((tabId) => {
          const tab = tabs[tabId];

          if (!tab) return null;

          return (
            <div
              className={`pane-tab${paneState.activeTabId === tabId ? " pane-tab--active" : ""}`}
              key={tabId}
              onClick={(e) => {
                e.stopPropagation();
                onTabSelect(tabId);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ tabId, x: e.clientX, y: e.clientY });
              }}
            >
              <span className="pane-tab-name">{tab.name}</span>
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

      {contextMenu ? (
        <div
          className="tab-context-menu"
          onClick={(e) => e.stopPropagation()}
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => { onTabClose(contextMenu.tabId); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeTab")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseOtherTabs(contextMenu.tabId); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeOtherTabs")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseTabsToRight(contextMenu.tabId); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeTabsToRight")}
          </button>
          <div className="tab-context-menu-separator" />
          <button
            className="tab-context-menu-item"
            onClick={() => { onCloseAllTabs(); setContextMenu(null); }}
            type="button"
          >
            {t("pane.closeAllTabs")}
          </button>
          {isSplitView ? (
            <>
              <div className="tab-context-menu-separator" />
              <button
                className="tab-context-menu-item"
                onClick={() => { onOpenInOtherPane(contextMenu.tabId); setContextMenu(null); }}
                type="button"
              >
                {t("pane.openInOtherPane")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab ? (
        <div className="editor-surface">
          <div className="editor-body">
            <Editor
              allFilePaths={allFilePaths}
              content={activeTab.content}
              key={activeTab.id}
              onChange={(content) => updateTabContent(activeTab.id, content)}
              settings={editorSettings}
              typewriterMode={typewriterMode}
              viewRef={viewRef}
            />
          </div>
          <div className="pane-status">
            <span>{t("app.wordCount", { chars: charCount, words: wordCount })}</span>
          </div>
        </div>
      ) : (
        <div className="empty-pane">
          <div className="empty-pane-copy">
            <p className="empty-pane-kicker">{t("pane.emptyKicker")}</p>
            <p className="empty-pane-message">{t("pane.noFiles")}</p>
          </div>
          {workspacePath ? (
            <form
              className="empty-pane-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newFileName.trim()) {
                  onCreateFile(newFileName.trim());
                  setNewFileName("");
                }
              }}
            >
              <input
                aria-label={t("pane.enterFileName")}
                className="text-input"
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={t("pane.enterFileName")}
                value={newFileName}
              />
              <button className="primary-button" disabled={!newFileName.trim()} type="submit">
                {t("pane.createFile")}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
