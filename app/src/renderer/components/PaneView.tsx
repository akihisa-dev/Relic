import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import type { DragEvent, MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { useT, type Translator } from "../i18n";
import { useEditorStore, type PaneId, type PanelTabKind } from "../store/editorStore";
import { useAutoSave } from "../hooks/useAutoSave";
import { Editor } from "./Editor";

export interface PaneViewProps {
  allFilePaths: string[];
  closingTabIds: Set<string>;
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  pane: PaneId;
  scrollTargetHeading?: string;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
  viewRef: MutableRefObject<EditorView | null>;
  renderGanttChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  onCreateFile: (name: string) => void;
  onFocus: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onScrollTargetHandled?: () => void;
  onTabClose: (tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseTabsToRight: (tabId: string) => void;
  onCloseAllTabs: () => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onOpenInOtherPane: (tabId: string) => void;
  onRevealTabFile?: (tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  pinnedPaths?: Set<string>;
  isSplitView: boolean;
}

export function PaneView({
  allFilePaths,
  closingTabIds,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  pane,
  scrollTargetHeading,
  typewriterMode,
  userDefinedFields,
  workspacePath,
  viewRef,
  renderGanttChartTab,
  renderPanelTab,
  renderPanelTabIcon,
  onCreateFile,
  onFocus,
  onOpenLink,
  onOpenWikiLink,
  onScrollTargetHandled,
  onTabClose,
  onTabMove,
  onTabSelect,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onDuplicateTabFile,
  onOpenInOtherPane,
  onRevealTabFile,
  onTogglePinTab,
  pinnedPaths,
  isSplitView
}: PaneViewProps): ReactElement {
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

  useAutoSave(
    activeTab?.kind === "file" ? activeTab.content : "",
    activeTab?.kind === "file" ? activeTab.path : null,
    activeTab?.kind === "file"
  );

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

  const charCount = activeTab?.kind === "file" ? activeTab.content.length : 0;
  const wordCount = activeTab?.kind === "file"
    ? activeTab.content.split(/\s+/).filter(Boolean).length
    : 0;
  const contextTab = contextMenu ? tabs[contextMenu.tabId] : null;
  const contextTabIsFile = contextTab?.kind === "file";
  const contextTabIsPinned = contextTabIsFile ? pinnedPaths?.has(contextTab.path) : false;
  const tabLabel = (tab: typeof activeTab): string => {
    if (!tab) return "";
    return tab.kind === "panel" ? panelTabLabel(tab.panel, t) : tab.name;
  };
  const readDraggedTab = (e: DragEvent): { fromPane: PaneId; tabId: string } | null => {
    const raw = e.dataTransfer.getData("application/relic-tab");
    if (!raw) return null;

    try {
      const payload = JSON.parse(raw) as { fromPane?: PaneId; tabId?: string };
      return payload.fromPane && payload.tabId ? { fromPane: payload.fromPane, tabId: payload.tabId } : null;
    } catch {
      return null;
    }
  };
  const dropPositionForTab = (e: DragEvent<HTMLElement>): "before" | "after" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
  };
  const isTabDrag = (e: DragEvent): boolean => Array.from(e.dataTransfer.types).includes("application/relic-tab");
  const handleTabDrop = (e: DragEvent<HTMLElement>, targetTabId?: string | null): void => {
    const draggedTab = readDraggedTab(e);
    if (!draggedTab) return;

    e.preventDefault();
    e.stopPropagation();
    onTabMove(draggedTab.fromPane, pane, draggedTab.tabId, targetTabId ?? null, targetTabId ? dropPositionForTab(e) : "after");
  };

  return (
    <div
      className={`pane${focusedPane === pane ? " pane--focused" : ""}`}
      onClick={onFocus}
      onFocusCapture={onFocus}
      onPointerDownCapture={onFocus}
    >
      <div
        className="pane-tab-bar"
        onDragOver={(e) => {
          if (isTabDrag(e)) e.preventDefault();
        }}
        onDrop={(e) => handleTabDrop(e, null)}
      >
        {paneState.tabIds.map((tabId) => {
          const tab = tabs[tabId];
          const isClosing = closingTabIds.has(tabId);

          if (!tab) return null;

          return (
            <div
              className={`pane-tab${paneState.activeTabId === tabId ? " pane-tab--active" : ""}${isClosing ? " pane-tab--closing" : ""}`}
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
                setContextMenu({ tabId, x: e.clientX, y: e.clientY });
              }}
              onDragOver={(e) => {
                if (isTabDrag(e)) e.preventDefault();
              }}
              onDragStart={(e) => {
                if (isClosing) return;
                e.dataTransfer.setData("application/relic-tab", JSON.stringify({ fromPane: pane, tabId }));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDrop={(e) => handleTabDrop(e, tabId)}
            >
              {tab.kind === "panel" ? (
                <span className="pane-tab-icon" aria-hidden="true">
                  {renderPanelTabIcon(tab.panel)}
                </span>
              ) : null}
              <span className="pane-tab-name">{tabLabel(tab)}</span>
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
          {contextTab ? (
            <>
              <button
                className="tab-context-menu-item"
                onClick={() => {
                  onTabSelect(contextMenu.tabId);
                  setContextMenu(null);
                }}
                type="button"
              >
                {t("files.open")}
              </button>
              {contextTabIsFile && onDuplicateTabFile ? (
                <button
                  className="tab-context-menu-item"
                  onClick={() => {
                    onDuplicateTabFile(contextMenu.tabId);
                    setContextMenu(null);
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
                    setContextMenu(null);
                  }}
                  type="button"
                >
                  {contextTabIsPinned ? t("files.unpin") : t("files.pin")}
                </button>
              ) : null}
              {contextTabIsFile ? (
                <>
                  <button
                    className="tab-context-menu-item"
                    onClick={() => {
                      void navigator.clipboard?.writeText(contextTab.path);
                      setContextMenu(null);
                    }}
                    type="button"
                  >
                    {t("files.copyPath")}
                  </button>
                  <button
                    className="tab-context-menu-item"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`[[${contextTab.path.replace(/\.md$/i, "")}]]`);
                      setContextMenu(null);
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
                    setContextMenu(null);
                  }}
                  type="button"
                >
                  {t("files.revealInFinder")}
                </button>
              ) : null}
              {isSplitView ? (
                <button
                  className="tab-context-menu-item"
                  onClick={() => { onOpenInOtherPane(contextMenu.tabId); setContextMenu(null); }}
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
              setContextMenu(null);
            }}
            type="button"
          >
            {t("pane.closeTab")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              onCloseOtherTabs(contextMenu.tabId);
              setContextMenu(null);
            }}
            type="button"
          >
            {t("pane.closeOtherTabs")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              onCloseTabsToRight(contextMenu.tabId);
              setContextMenu(null);
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
              setContextMenu(null);
            }}
            type="button"
          >
            {t("pane.closeAllTabs")}
          </button>
        </div>
      ) : null}

      {activeTab?.kind === "file" ? (
        <div
          className={`editor-surface${editorActionPulse > 0 ? ` editor-surface--action-${editorActionPulse % 2 === 0 ? "even" : "odd"}` : ""}`}
        >
          <div className="editor-body">
            <Editor
              allFilePaths={allFilePaths}
              content={activeTab.content}
              frontmatterCandidates={frontmatterCandidates}
              key={activeTab.id}
              onChange={(content) => updateTabContent(activeTab.id, content)}
              onOpenLink={onOpenLink}
              onOpenWikiLink={onOpenWikiLink}
              settings={editorSettings}
              typewriterMode={typewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={viewRef}
            />
          </div>
          <div className="pane-status">
            <span>{t("app.wordCount", { chars: charCount, words: wordCount })}</span>
          </div>
        </div>
      ) : activeTab?.kind === "panel" ? (
        <div className="editor-surface panel-tab-surface">
          <div className="panel-tab-body">
            {renderPanelTab(activeTab.panel)}
          </div>
        </div>
      ) : activeTab?.kind === "gantt" ? (
        <div className="editor-surface panel-tab-surface">
          <div className="panel-tab-body">
            {renderGanttChartTab(activeTab.chartId)}
          </div>
        </div>
      ) : (
        <div className="empty-pane">
          <div className="empty-pane-copy">
            <p className="empty-pane-kicker">{t("pane.emptyKicker")}</p>
            <p className="empty-pane-message">{t("pane.noFiles")}</p>
          </div>
          {workspacePath ? (
            <div className="empty-pane-form">
              <button className="primary-button" onClick={() => onCreateFile("")} type="button">
                {t("pane.createFile")}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function panelTabLabel(panel: PanelTabKind, t: Translator): string {
  if (panel === "frontmatter") return t("nav.frontmatter");
  if (panel === "git") return t("nav.git");
  if (panel === "settings") return t("nav.settings");
  return t("nav.tools");
}
