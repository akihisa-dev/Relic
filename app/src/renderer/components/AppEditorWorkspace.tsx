import type { EditorView } from "@codemirror/view";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, ReactElement, ReactNode, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import type { HeadingScrollTarget, OutlineHeading } from "../editorDerivedState";
import type { FileTab, PaneId, PanelTabKind } from "../store/editorStore";
import type { RightPanelView, SecondarySidebarView } from "../store/uiStore";
import { AppRightPanel } from "./AppRightPanel";
import { AppSecondarySidebar } from "./AppSecondarySidebar";
import { LayoutResizeBoundary } from "./LayoutResizeBoundary";
import { PaneView } from "./PaneView";

interface AppEditorWorkspaceProps {
  aiWorkspaceState: AIWorkspaceState | null;
  aiWorkspaceMessagePreview: AIWorkspaceMessagePreview | null;
  allFilePaths: string[];
  backlinks: Backlink[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  isLoadingBacklinks: boolean;
  isAIWorkspaceLoading: boolean;
  isAIWorkspaceSending: boolean;
  isRightPanelOpen: boolean;
  isRightPanelResizing: boolean;
  isSecondarySidebarResizing: boolean;
  isLeftSourceMode: boolean;
  isRightSourceMode: boolean;
  isSplit: boolean;
  isSplitClosing: boolean;
  isSecondarySidebarOpen: boolean;
  isTypewriterMode: boolean;
  leftEditorViewRef: MutableRefObject<EditorView | null>;
  leftClosingTabIds: Set<string>;
  leftPaneScrollHeading?: HeadingScrollTarget;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onCreateFile: (name: string) => void;
  onAIWorkspaceClearData: () => void;
  onAIWorkspaceApplyOperations: (operationIds?: string[]) => void;
  onAIWorkspaceCancelMessagePreview: () => void;
  onAIWorkspaceCancelSending: () => void;
  onAIWorkspaceConfirmMessagePreview: () => void;
  onAIWorkspaceRebuildIndex: () => void;
  onAIWorkspaceDiscardOperations: (operationIds?: string[]) => void;
  onAIWorkspaceSendMessage: (message: string) => void;
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
  onSecondarySidebarClose: () => void;
  onSecondarySidebarResizeStart: (event: ReactMouseEvent) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  onSetFocusedPane: (pane: PaneId) => void;
  onSourceModeToggle: (pane: PaneId) => void;
  onSplitToggle: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
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
  secondarySidebarView: SecondarySidebarView;
  secondarySidebarWidth: number;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
  showRightPanelLinksControl: boolean;
  showRightPanelOutlineControl: boolean;
  userDefinedFields: UserDefinedField[];
  workspaceName?: string | null;
  workspacePath?: string | null;
}

export function AppEditorWorkspace({
  aiWorkspaceState,
  aiWorkspaceMessagePreview,
  allFilePaths,
  backlinks,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  isLoadingBacklinks,
  isAIWorkspaceLoading,
  isAIWorkspaceSending,
  isRightPanelOpen,
  isRightPanelResizing,
  isSecondarySidebarResizing,
  isLeftSourceMode,
  isRightSourceMode,
  isSplit,
  isSplitClosing,
  isSecondarySidebarOpen,
  isTypewriterMode,
  leftEditorViewRef,
  leftClosingTabIds,
  leftPaneScrollHeading,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCreateFile,
  onAIWorkspaceClearData,
  onAIWorkspaceApplyOperations,
  onAIWorkspaceCancelMessagePreview,
  onAIWorkspaceCancelSending,
  onAIWorkspaceRebuildIndex,
  onAIWorkspaceDiscardOperations,
  onAIWorkspaceConfirmMessagePreview,
  onAIWorkspaceSendMessage,
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
  onSecondarySidebarClose,
  onSecondarySidebarResizeStart,
  onScrollTargetHandled,
  onSetFocusedPane,
  onSourceModeToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
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
  secondarySidebarView,
  secondarySidebarWidth,
  setLinkContextMenu,
  userDefinedFields,
  workspaceName,
  workspacePath
}: AppEditorWorkspaceProps): ReactElement {
  return (
    <main className="main-area">
      <div className="editor-layout">
        <AppSecondarySidebar
          aiWorkspaceState={aiWorkspaceState}
          aiWorkspaceMessagePreview={aiWorkspaceMessagePreview}
          isAIWorkspaceLoading={isAIWorkspaceLoading}
          isAIWorkspaceSending={isAIWorkspaceSending}
          isOpen={isSecondarySidebarOpen}
          isResizing={isSecondarySidebarResizing}
          onAIWorkspaceClearData={onAIWorkspaceClearData}
          onAIWorkspaceApplyOperations={onAIWorkspaceApplyOperations}
          onAIWorkspaceCancelMessagePreview={onAIWorkspaceCancelMessagePreview}
          onAIWorkspaceCancelSending={onAIWorkspaceCancelSending}
          onAIWorkspaceConfirmMessagePreview={onAIWorkspaceConfirmMessagePreview}
          onAIWorkspaceRebuildIndex={onAIWorkspaceRebuildIndex}
          onAIWorkspaceDiscardOperations={onAIWorkspaceDiscardOperations}
          onAIWorkspaceSendMessage={onAIWorkspaceSendMessage}
          onClose={onSecondarySidebarClose}
          onOpenFile={onOpenFile}
          onResizeStart={onSecondarySidebarResizeStart}
          view={secondarySidebarView}
          width={secondarySidebarWidth}
          workspaceName={workspaceName}
        />
        {isSecondarySidebarOpen ? (
          <LayoutResizeBoundary
            aria-label="Resize secondary sidebar"
            isActive={isSecondarySidebarResizing}
            onResizeStart={onSecondarySidebarResizeStart}
            side="secondary-sidebar"
          />
        ) : null}
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
          backlinks={backlinks}
          isLoadingBacklinks={isLoadingBacklinks}
          isOpen={isRightPanelOpen}
          isResizing={isRightPanelResizing}
          onOpenFile={onOpenFile}
          onOpenWikiLink={onOpenWikiLink}
          onOutlineHeadingClick={onOutlineHeadingClick}
          onResizeStart={onRightPanelResizeStart}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          outgoingLinksLimited={outgoingLinksLimited}
          rightPanelView={rightPanelView}
          setLinkContextMenu={setLinkContextMenu}
          width={rightPanelWidth}
        />
      </div>
    </main>
  );
}
