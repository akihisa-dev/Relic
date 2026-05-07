import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { EditorSettings } from "../../shared/ipc";
import { useT } from "../i18n";
import { useEditorStore, type PaneId } from "../store/editorStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { Editor } from "./Editor";
import { FrontmatterForm } from "./FrontmatterForm";
import { Preview } from "./Preview";
import { Toolbar } from "./Toolbar";

export interface PaneViewProps {
  allFilePaths: string[];
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  pane: PaneId;
  scrollTargetHeading?: string;
  showFrontmatter?: boolean;
  typewriterMode: boolean;
  workspacePath?: string | null;
  workspaceTags: string[];
  onCreateNote: (name: string) => void;
  onFocus: () => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onScrollTargetHandled?: () => void;
  onTabClose: (tabId: string) => void;
  onTabSelect: (tabId: string) => void;
  onTagSearch: (tag: string) => void;
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
  frontmatterCandidates,
  pane,
  scrollTargetHeading,
  showFrontmatter = true,
  typewriterMode,
  workspacePath,
  workspaceTags,
  onCreateNote,
  onFocus,
  onOpenWikiLink,
  onScrollTargetHandled,
  onTabClose,
  onTabSelect,
  onTagSearch,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onOpenInOtherPane,
  isSplitView
}: PaneViewProps): ReactElement {
  const [newNoteName, setNewNoteName] = useState("");
  const [contextMenu, setContextMenu] = useState<{ tabId: string; x: number; y: number } | null>(null);
  const { leftPane, rightPane, tabs, updateTabContent, setTabViewMode } = useEditorStore();
  const paneState = pane === "left" ? leftPane : rightPane;
  const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  const viewRef = useRef<EditorView | null>(null);
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
          <div className="editor-mode-bar">
            <Toolbar viewRef={viewRef} />
            <div className="editor-mode-toggle">
              <button
                className={`mode-btn${activeTab.viewMode === "preview" ? " mode-btn--active" : ""}`}
                onClick={() => setTabViewMode(activeTab.id, "preview")}
                type="button"
              >
                Preview
              </button>
              <button
                className={`mode-btn${activeTab.viewMode === "source" ? " mode-btn--active" : ""}`}
                onClick={() => setTabViewMode(activeTab.id, "source")}
                type="button"
              >
                Source
              </button>
            </div>
          </div>
          <div className="editor-body">
            {activeTab.viewMode === "preview" ? (
              <div className="preview-with-fm">
                {showFrontmatter && (
                  <FrontmatterForm
                    candidates={frontmatterCandidates}
                    content={activeTab.content}
                    key={`fm-${activeTab.id}`}
                    onChange={(content) => updateTabContent(activeTab.id, content)}
                    workspaceTags={workspaceTags}
                  />
                )}
                <Preview
                  content={activeTab.content}
                  key={`preview-${activeTab.id}`}
                  onChange={(content) => updateTabContent(activeTab.id, content)}
                  onOpenWikiLink={onOpenWikiLink}
                  onScrollTargetHandled={onScrollTargetHandled}
                  onTagSearch={onTagSearch}
                  scrollTargetHeading={scrollTargetHeading}
                  settings={editorSettings}
                  workspacePath={workspacePath}
                />
              </div>
            ) : (
              <Editor
                allFilePaths={allFilePaths}
                content={activeTab.content}
                key={activeTab.id}
                onChange={(content) => updateTabContent(activeTab.id, content)}
                settings={editorSettings}
                typewriterMode={typewriterMode}
                viewRef={viewRef}
              />
            )}
          </div>
          <div className="pane-status">
            <span>{t("app.wordCount", { chars: charCount, words: wordCount })}</span>
          </div>
        </div>
      ) : (
        <div className="empty-pane">
          <p className="empty-pane-message">{t("pane.noNotes")}</p>
          {workspacePath ? (
            <form
              className="empty-pane-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newNoteName.trim()) {
                  onCreateNote(newNoteName.trim());
                  setNewNoteName("");
                }
              }}
            >
              <input
                aria-label={t("pane.enterNoteName")}
                className="text-input"
                onChange={(e) => setNewNoteName(e.target.value)}
                placeholder={t("pane.enterNoteName")}
                value={newNoteName}
              />
              <button className="primary-button" disabled={!newNoteName.trim()} type="submit">
                {t("pane.createNote")}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
