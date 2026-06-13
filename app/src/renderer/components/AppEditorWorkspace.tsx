import type { EditorView } from "@codemirror/view";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, ReactElement, ReactNode, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import type { HeadingScrollTarget, OutlineHeading } from "../editorDerivedState";
import type { FileTab, PaneId, PanelTabKind } from "../store/editorStore";
import type { RightPanelView } from "../store/uiStore";
import { AppRightPanel } from "./AppRightPanel";
import { LayoutResizeBoundary } from "./LayoutResizeBoundary";
import { PaneView } from "./PaneView";

interface AppEditorWorkspaceProps {
  allFilePaths: string[];
  activeFileTab: FileTab | null;
  backlinks: Backlink[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  isLoadingBacklinks: boolean;
  isRightPanelOpen: boolean;
  isRightPanelResizing: boolean;
  isLeftSourceMode: boolean;
  isRightSourceMode: boolean;
  isSplit: boolean;
  isSplitClosing: boolean;
  isTypewriterMode: boolean;
  leftEditorViewRef: MutableRefObject<EditorView | null>;
  leftClosingTabIds: Set<string>;
  leftPaneScrollHeading?: HeadingScrollTarget;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onCreateFile: (name: string) => void;
  onEditorAction: () => void;
  onFileSaved: () => void;
  onFileSaveError: (message: string) => void;
  onLargeMarkdownFallback: (name: string, path: string) => void;
  onOpenFile: (path: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onOpenLink: (href: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: OutlineHeading) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onPrintPreview: (tab: FileTab) => void;
  onRenameFile: (path: string, name: string) => void;
  onRevealTabFile?: (tabId: string) => void;
  onRightPanelResizeStart: (event: ReactMouseEvent) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onSavePreviewAsPdf: (tab: FileTab) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  onSetFocusedPane: (pane: PaneId) => void;
  onSourceModeToggle: (pane: PaneId) => void;
  onSplitToggle: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  onUpdateTabContent: (tabId: string, content: string) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  outgoingLinksLimited: boolean;
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  rightEditorViewRef: MutableRefObject<EditorView | null>;
  rightClosingTabIds: Set<string>;
  rightPaneScrollHeading?: HeadingScrollTarget;
  rightPanelView: RightPanelView;
  rightPanelWidth: number;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  showRightPanelFrontmatterControl: boolean;
  showRightPanelLinksControl: boolean;
  showRightPanelOutlineControl: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
}

export function AppEditorWorkspace({
  allFilePaths,
  activeFileTab,
  backlinks,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  isLoadingBacklinks,
  isRightPanelOpen,
  isRightPanelResizing,
  isLeftSourceMode,
  isRightSourceMode,
  isSplit,
  isSplitClosing,
  isTypewriterMode,
  leftEditorViewRef,
  leftClosingTabIds,
  leftPaneScrollHeading,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCreateFile,
  onEditorAction,
  onFileSaved,
  onFileSaveError,
  onLargeMarkdownFallback,
  onOpenFile,
  onOpenInOtherPane,
  onOpenLink,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onDuplicateTabFile,
  onPrintPreview,
  onRenameFile,
  onRevealTabFile,
  onRightPanelResizeStart,
  onSavePreviewAsPdf,
  onScrollTargetHandled,
  onSetFocusedPane,
  onSourceModeToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
  onUpdateTabContent,
  outlineHeadings,
  outgoingLinks,
  outgoingLinksLimited,
  renderChartTab,
  renderPanelTab,
  renderPanelTabIcon,
  rightEditorViewRef,
  rightClosingTabIds,
  rightPaneScrollHeading,
  rightPanelView,
  rightPanelWidth,
  setLinkContextMenu,
  showRightPanelFrontmatterControl,
  userDefinedFields,
  workspacePath
}: AppEditorWorkspaceProps): ReactElement {
  void showRightPanelFrontmatterControl;

  return (
    <main className="main-area">
      <div className="editor-layout">
        <div className="editor-workspace">
          <div className={`panes-container${isSplit ? " panes-container--split" : ""}${isSplitClosing ? " panes-container--closing-split" : ""}`}>
            <PaneView
              allFilePaths={allFilePaths}
              editorActionPulse={focusedPane === "left" ? editorActionPulse : 0}
              editorSettings={editorSettings}
              focusedPane={focusedPane}
              frontmatterCandidates={frontmatterCandidates}
              closingTabIds={leftClosingTabIds}
              isSplitView={isSplit}
              pane="left"
              renderChartTab={renderChartTab}
              renderPanelTab={renderPanelTab}
              renderPanelTabIcon={renderPanelTabIcon}
              scrollTargetHeading={leftPaneScrollHeading}
              sourceMode={isLeftSourceMode}
              onSourceModeToggle={() => onSourceModeToggle("left")}
              typewriterMode={isTypewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={leftEditorViewRef}
              workspacePath={workspacePath}
              onCloseAllTabs={onCloseAllTabsInPane}
              onCloseOtherTabs={onCloseOtherTabs}
              onCloseTabsToRight={onCloseTabsToRight}
              onCreateFile={onCreateFile}
              onDuplicateTabFile={onDuplicateTabFile}
              onEditorAction={onEditorAction}
              onFileSaveError={onFileSaveError}
              onFileSaved={onFileSaved}
              onFocus={() => onSetFocusedPane("left")}
              onLargeMarkdownFallback={onLargeMarkdownFallback}
              onOpenFile={onOpenFile}
              onOpenInOtherPane={onOpenInOtherPane}
              onOpenLink={onOpenLink}
              onOpenWikiLink={onOpenWikiLink}
              onPrintPreview={onPrintPreview}
              onRenameFile={onRenameFile}
              onRevealTabFile={onRevealTabFile}
              onSavePreviewAsPdf={onSavePreviewAsPdf}
              onScrollTargetHandled={() => onScrollTargetHandled("left")}
              onTabClose={onTabClose}
              onTabMove={onTabMove}
              onTabSelect={onTabSelect}
              onTogglePinTab={onTogglePinTab}
            />
            {isSplit ? (
              <PaneView
                allFilePaths={allFilePaths}
                editorActionPulse={focusedPane === "right" ? editorActionPulse : 0}
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                frontmatterCandidates={frontmatterCandidates}
                closingTabIds={rightClosingTabIds}
                isSplitView={isSplit}
                pane="right"
                renderChartTab={renderChartTab}
                renderPanelTab={renderPanelTab}
                renderPanelTabIcon={renderPanelTabIcon}
                scrollTargetHeading={rightPaneScrollHeading}
                sourceMode={isRightSourceMode}
                onSourceModeToggle={() => onSourceModeToggle("right")}
                typewriterMode={isTypewriterMode}
                userDefinedFields={userDefinedFields}
                viewRef={rightEditorViewRef}
                workspacePath={workspacePath}
                onCloseAllTabs={onCloseAllTabsInPane}
                onCloseOtherTabs={onCloseOtherTabs}
                onCloseTabsToRight={onCloseTabsToRight}
                onCreateFile={onCreateFile}
                onDuplicateTabFile={onDuplicateTabFile}
                onEditorAction={onEditorAction}
                onFileSaveError={onFileSaveError}
                onFileSaved={onFileSaved}
                onFocus={() => onSetFocusedPane("right")}
                onLargeMarkdownFallback={onLargeMarkdownFallback}
                onOpenFile={onOpenFile}
                onOpenInOtherPane={onOpenInOtherPane}
                onOpenLink={onOpenLink}
                onOpenWikiLink={onOpenWikiLink}
                onPrintPreview={onPrintPreview}
                onRenameFile={onRenameFile}
                onRevealTabFile={onRevealTabFile}
                onSavePreviewAsPdf={onSavePreviewAsPdf}
                onScrollTargetHandled={() => onScrollTargetHandled("right")}
                onTabClose={onTabClose}
                onTabMove={onTabMove}
                onTabSelect={onTabSelect}
                onTogglePinTab={onTogglePinTab}
              />
            ) : null}
          </div>
        </div>

        {isRightPanelOpen ? (
          <LayoutResizeBoundary
            aria-label="Resize right panel"
            isActive={isRightPanelResizing}
            onResizeStart={onRightPanelResizeStart}
            side="right-panel"
          />
        ) : null}
        <AppRightPanel
          activeFileTab={activeFileTab}
          backlinks={backlinks}
          editorSettings={editorSettings}
          frontmatterCandidates={frontmatterCandidates}
          isLoadingBacklinks={isLoadingBacklinks}
          isOpen={isRightPanelOpen}
          isResizing={isRightPanelResizing}
          onOpenFile={onOpenFile}
          onOpenWikiLink={onOpenWikiLink}
          onOutlineHeadingClick={onOutlineHeadingClick}
          onResizeStart={onRightPanelResizeStart}
          onUpdateTabContent={onUpdateTabContent}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          outgoingLinksLimited={outgoingLinksLimited}
          rightPanelView={rightPanelView}
          setLinkContextMenu={setLinkContextMenu}
          userDefinedFields={userDefinedFields}
          width={rightPanelWidth}
        />
      </div>
    </main>
  );
}
