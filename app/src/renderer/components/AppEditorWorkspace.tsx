import type { EditorView } from "@codemirror/view";
import type { Dispatch, MutableRefObject, ReactElement, ReactNode, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import type { OutlineHeading } from "../editorDerivedState";
import { useT } from "../i18n";
import type { PaneId, PanelTabKind } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { AppRightPanel } from "./AppRightPanel";
import { PaneView } from "./PaneView";

interface AppEditorWorkspaceProps {
  allFilePaths: string[];
  backlinks: Backlink[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  isLoadingBacklinks: boolean;
  isRightPanelOpen: boolean;
  isSourceMode: boolean;
  isSplit: boolean;
  isSplitClosing: boolean;
  isTypewriterMode: boolean;
  leftClosingTabIds: Set<string>;
  leftEditorViewRef: MutableRefObject<EditorView | null>;
  leftPaneScrollHeading?: string;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onCreateFile: (name: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onEditorAction: () => void;
  onFileSaved: () => void;
  onOpenFile: (path: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onOpenLink: (href: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onRevealTabFile?: (tabId: string) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  onSetFocusedPane: (pane: PaneId) => void;
  onSourceModeToggle: () => void;
  onSplitToggle: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  pinnedPaths: Set<string>;
  renderGanttChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  rightClosingTabIds: Set<string>;
  rightEditorViewRef: MutableRefObject<EditorView | null>;
  rightPaneScrollHeading?: string;
  rightPanelView: RightPanelView;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  showRightPanelControls: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
}

export function AppEditorWorkspace({
  allFilePaths,
  backlinks,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  isLoadingBacklinks,
  isRightPanelOpen,
  isSourceMode,
  isSplit,
  isSplitClosing,
  isTypewriterMode,
  leftClosingTabIds,
  leftEditorViewRef,
  leftPaneScrollHeading,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCreateFile,
  onDuplicateTabFile,
  onEditorAction,
  onFileSaved,
  onOpenFile,
  onOpenInOtherPane,
  onOpenLink,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onRenameFile,
  onRevealTabFile,
  onRightPanelViewButton,
  onScrollTargetHandled,
  onSetFocusedPane,
  onSourceModeToggle,
  onSplitToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
  outlineHeadings,
  outgoingLinks,
  pinnedPaths,
  renderGanttChartTab,
  renderPanelTab,
  renderPanelTabIcon,
  rightClosingTabIds,
  rightEditorViewRef,
  rightPaneScrollHeading,
  rightPanelView,
  setLinkContextMenu,
  showRightPanelControls,
  userDefinedFields,
  workspacePath
}: AppEditorWorkspaceProps): ReactElement {
  const t = useT();

  return (
    <main className="main-area">
      <div className="main-area-actions">
        <button
          aria-label={t("pane.sourceShort")}
          className={`toolbar-btn${isSourceMode ? " active" : ""}`}
          onClick={onSourceModeToggle}
          title={t("pane.sourceMode")}
          type="button"
        >
          <SourceModeIcon />
        </button>
        <button
          aria-label={t("pane.splitShort")}
          className={`toolbar-btn${isSplit ? " active" : ""}`}
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
              onClick={() => onRightPanelViewButton("outline")}
              title={t("pane.toggleOutline")}
              type="button"
            >
              <OutlineIcon />
            </button>
            <button
              aria-label={t("pane.links")}
              className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
              onClick={() => onRightPanelViewButton("links")}
              title={t("pane.toggleLinks")}
              type="button"
            >
              <LinksIcon />
            </button>
          </>
        ) : null}
      </div>
      <div className="editor-layout">
        <div className="editor-workspace">
          <div className={`panes-container${isSplit ? " panes-container--split" : ""}${isSplitClosing ? " panes-container--closing-split" : ""}`}>
            <PaneView
              allFilePaths={allFilePaths}
              closingTabIds={leftClosingTabIds}
              editorActionPulse={focusedPane === "left" ? editorActionPulse : 0}
              editorSettings={editorSettings}
              focusedPane={focusedPane}
              frontmatterCandidates={frontmatterCandidates}
              isSplitView={isSplit}
              pane="left"
              pinnedPaths={pinnedPaths}
              renderGanttChartTab={renderGanttChartTab}
              renderPanelTab={renderPanelTab}
              renderPanelTabIcon={renderPanelTabIcon}
              scrollTargetHeading={leftPaneScrollHeading}
              sourceMode={isSourceMode}
              typewriterMode={isTypewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={leftEditorViewRef}
              workspacePath={workspacePath}
              onCloseAllTabs={() => onCloseAllTabsInPane("left")}
              onCloseOtherTabs={(tabId) => onCloseOtherTabs("left", tabId)}
              onCloseTabsToRight={(tabId) => onCloseTabsToRight("left", tabId)}
              onCreateFile={onCreateFile}
              onDuplicateTabFile={onDuplicateTabFile}
              onEditorAction={onEditorAction}
              onFileSaved={onFileSaved}
              onFocus={() => onSetFocusedPane("left")}
              onOpenInOtherPane={(tabId) => onOpenInOtherPane("left", tabId)}
              onOpenLink={onOpenLink}
              onOpenWikiLink={onOpenWikiLink}
              onRenameFile={onRenameFile}
              onRevealTabFile={onRevealTabFile}
              onScrollTargetHandled={() => onScrollTargetHandled("left")}
              onTabClose={(tabId) => onTabClose("left", tabId)}
              onTabMove={onTabMove}
              onTabSelect={(tabId) => onTabSelect("left", tabId)}
              onTogglePinTab={onTogglePinTab}
            />
            {isSplit ? (
              <PaneView
                allFilePaths={allFilePaths}
                closingTabIds={rightClosingTabIds}
                editorActionPulse={focusedPane === "right" ? editorActionPulse : 0}
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                frontmatterCandidates={frontmatterCandidates}
                isSplitView={isSplit}
                pane="right"
                pinnedPaths={pinnedPaths}
                renderGanttChartTab={renderGanttChartTab}
                renderPanelTab={renderPanelTab}
                renderPanelTabIcon={renderPanelTabIcon}
                scrollTargetHeading={rightPaneScrollHeading}
                sourceMode={isSourceMode}
                typewriterMode={isTypewriterMode}
                userDefinedFields={userDefinedFields}
                viewRef={rightEditorViewRef}
                workspacePath={workspacePath}
                onCloseAllTabs={() => onCloseAllTabsInPane("right")}
                onCloseOtherTabs={(tabId) => onCloseOtherTabs("right", tabId)}
                onCloseTabsToRight={(tabId) => onCloseTabsToRight("right", tabId)}
                onCreateFile={onCreateFile}
                onDuplicateTabFile={onDuplicateTabFile}
                onEditorAction={onEditorAction}
                onFileSaved={onFileSaved}
                onFocus={() => onSetFocusedPane("right")}
                onOpenInOtherPane={(tabId) => onOpenInOtherPane("right", tabId)}
                onOpenLink={onOpenLink}
                onOpenWikiLink={onOpenWikiLink}
                onRenameFile={onRenameFile}
                onRevealTabFile={onRevealTabFile}
                onScrollTargetHandled={() => onScrollTargetHandled("right")}
                onTabClose={(tabId) => onTabClose("right", tabId)}
                onTabMove={onTabMove}
                onTabSelect={(tabId) => onTabSelect("right", tabId)}
                onTogglePinTab={onTogglePinTab}
              />
            ) : null}
          </div>
        </div>

        <AppRightPanel
          backlinks={backlinks}
          isLoadingBacklinks={isLoadingBacklinks}
          isOpen={isRightPanelOpen}
          onOpenFile={onOpenFile}
          onOpenWikiLink={onOpenWikiLink}
          onOutlineHeadingClick={onOutlineHeadingClick}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          rightPanelView={rightPanelView}
          setLinkContextMenu={setLinkContextMenu}
        />
      </div>
    </main>
  );
}

function SourceModeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18">
      <polyline points="7.5,5.5 3.5,10 7.5,14.5" />
      <polyline points="12.5,5.5 16.5,10 12.5,14.5" />
      <line x1="10.8" x2="9.2" y1="4" y2="16" />
    </svg>
  );
}

function SplitViewIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18">
      <rect height="13" rx="2" width="14" x="3" y="4" />
      <line x1="10" x2="10" y1="4" y2="17" />
    </svg>
  );
}

function OutlineIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18">
      <line x1="8" x2="16" y1="5" y2="5" />
      <line x1="8" x2="14" y1="10" y2="10" />
      <line x1="8" x2="15" y1="15" y2="15" />
      <circle cx="4.5" cy="5" r="1" />
      <circle cx="4.5" cy="10" r="1" />
      <circle cx="4.5" cy="15" r="1" />
    </svg>
  );
}

function LinksIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 20 20" width="18">
      <path d="M8.4 6.2l1-1a4 4 0 0 1 5.7 5.7l-1 1" />
      <path d="M11.6 13.8l-1 1a4 4 0 1 1-5.7-5.7l1-1" />
      <line x1="7.8" x2="12.2" y1="12.2" y2="7.8" />
    </svg>
  );
}
