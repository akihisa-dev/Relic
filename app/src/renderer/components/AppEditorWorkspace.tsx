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
  isSourceMode: boolean;
  isSplit: boolean;
  isSplitClosing: boolean;
  isSecondarySidebarOpen: boolean;
  isTypewriterMode: boolean;
  leftClosingTabIds: Set<string>;
  leftEditorViewRef: MutableRefObject<EditorView | null>;
  leftPaneScrollHeading?: HeadingScrollTarget;
  onCreateFile: (name: string) => void;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
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
  onPrintPreview: (tab: FileTab) => void;
  onRevealTabFile?: (tabId: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onRightPanelResizeStart: (event: ReactMouseEvent) => void;
  onSecondarySidebarClose: () => void;
  onSecondarySidebarResizeStart: (event: ReactMouseEvent) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  onSetFocusedPane: (pane: PaneId) => void;
  onSavePreviewAsPdf: (tab: FileTab) => void;
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
  rightClosingTabIds: Set<string>;
  rightEditorViewRef: MutableRefObject<EditorView | null>;
  rightPaneScrollHeading?: HeadingScrollTarget;
  rightPanelView: RightPanelView;
  rightPanelWidth: number;
  secondarySidebarView: SecondarySidebarView;
  secondarySidebarWidth: number;
  setLinkContextMenu: Dispatch<SetStateAction<AppLinkContextMenu | null>>;
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
  isSourceMode,
  isSplit,
  isSplitClosing,
  isSecondarySidebarOpen,
  isTypewriterMode,
  leftClosingTabIds,
  leftEditorViewRef,
  leftPaneScrollHeading,
  onCreateFile,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onDuplicateTabFile,
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
  onPrintPreview,
  onRevealTabFile,
  onRenameFile,
  onRightPanelResizeStart,
  onSecondarySidebarClose,
  onSecondarySidebarResizeStart,
  onScrollTargetHandled,
  onSetFocusedPane,
  onSavePreviewAsPdf,
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
  rightClosingTabIds,
  rightEditorViewRef,
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
              sourceMode={isSourceMode}
              typewriterMode={isTypewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={leftEditorViewRef}
              workspacePath={workspacePath}
              onCreateFile={onCreateFile}
              onCloseAllTabsInPane={onCloseAllTabsInPane}
              onCloseOtherTabs={onCloseOtherTabs}
              onCloseTabsToRight={onCloseTabsToRight}
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
              onRevealTabFile={onRevealTabFile}
              onRenameFile={onRenameFile}
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
                sourceMode={isSourceMode}
                typewriterMode={isTypewriterMode}
                userDefinedFields={userDefinedFields}
                viewRef={rightEditorViewRef}
                workspacePath={workspacePath}
                onCreateFile={onCreateFile}
                onCloseAllTabsInPane={onCloseAllTabsInPane}
                onCloseOtherTabs={onCloseOtherTabs}
                onCloseTabsToRight={onCloseTabsToRight}
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
                onRevealTabFile={onRevealTabFile}
                onRenameFile={onRenameFile}
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
