import type { EditorView } from "@codemirror/view";
import type { Dispatch, MutableRefObject, ReactElement, ReactNode, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import type { OutlineHeading } from "../editorDerivedState";
import type { PaneId, PanelTabKind } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { AppRightPanel } from "./AppRightPanel";
import { AppTopBar } from "./AppTopBar";
import { PaneView } from "./PaneView";

interface AppEditorWorkspaceProps {
  activeFileName: string | null;
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
  onMoveActiveFile: (destinationFolder: string) => void;
  onOpenFile: (path: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onOpenLink: (href: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: string) => void;
  onRenameActiveFile: (name: string) => void;
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
  activeFileName,
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
  onMoveActiveFile,
  onOpenFile,
  onOpenInOtherPane,
  onOpenLink,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onRenameActiveFile,
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
  return (
    <main className="main-area">
      <AppTopBar
        activeFileName={activeFileName}
        isRightPanelOpen={isRightPanelOpen}
        isSourceMode={isSourceMode}
        isSplit={isSplit}
        onMoveActiveFile={onMoveActiveFile}
        onRenameActiveFile={onRenameActiveFile}
        onRightPanelViewButton={onRightPanelViewButton}
        onSourceModeToggle={onSourceModeToggle}
        onSplitToggle={onSplitToggle}
        rightPanelView={rightPanelView}
        showRightPanelControls={showRightPanelControls}
      />

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
