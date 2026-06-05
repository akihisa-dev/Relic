import type { EditorView } from "@codemirror/view";
import type { Dispatch, MouseEvent as ReactMouseEvent, MutableRefObject, ReactElement, ReactNode, SetStateAction } from "react";

import type { Backlink, EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";
import type { ResolvedWikiLink } from "../../shared/links";
import type { AppLinkContextMenu } from "../appLinks";
import type { HeadingScrollTarget, OutlineHeading } from "../editorDerivedState";
import type { PaneId, PanelTabKind } from "../store/editorStore";
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
  leftEditorViewRef: MutableRefObject<EditorView | null>;
  leftPaneScrollHeading?: HeadingScrollTarget;
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
  onOpenLink: (href: string) => void;
  onOpenWikiLink: (target: string, heading?: string) => void;
  onOutlineHeadingClick: (heading: OutlineHeading) => void;
  onRenameFile: (path: string, name: string) => void;
  onRightPanelResizeStart: (event: ReactMouseEvent) => void;
  onSecondarySidebarClose: () => void;
  onSecondarySidebarResizeStart: (event: ReactMouseEvent) => void;
  onScrollTargetHandled: (pane: PaneId) => void;
  onSetFocusedPane: (pane: PaneId) => void;
  outlineHeadings: OutlineHeading[];
  outgoingLinks: ResolvedWikiLink[];
  outgoingLinksLimited: boolean;
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
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
  leftEditorViewRef,
  leftPaneScrollHeading,
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
  onOpenLink,
  onOpenWikiLink,
  onOutlineHeadingClick,
  onRenameFile,
  onRightPanelResizeStart,
  onSecondarySidebarClose,
  onSecondarySidebarResizeStart,
  onScrollTargetHandled,
  onSetFocusedPane,
  outlineHeadings,
  outgoingLinks,
  outgoingLinksLimited,
  renderChartTab,
  renderPanelTab,
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
              pane="left"
              renderChartTab={renderChartTab}
              renderPanelTab={renderPanelTab}
              scrollTargetHeading={leftPaneScrollHeading}
              sourceMode={isSourceMode}
              typewriterMode={isTypewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={leftEditorViewRef}
              workspacePath={workspacePath}
              onCreateFile={onCreateFile}
              onEditorAction={onEditorAction}
              onFileSaveError={onFileSaveError}
              onFileSaved={onFileSaved}
              onFocus={() => onSetFocusedPane("left")}
              onLargeMarkdownFallback={onLargeMarkdownFallback}
              onOpenLink={onOpenLink}
              onOpenWikiLink={onOpenWikiLink}
              onRenameFile={onRenameFile}
              onScrollTargetHandled={() => onScrollTargetHandled("left")}
            />
            {isSplit ? (
              <PaneView
                allFilePaths={allFilePaths}
                editorActionPulse={focusedPane === "right" ? editorActionPulse : 0}
                editorSettings={editorSettings}
                focusedPane={focusedPane}
                frontmatterCandidates={frontmatterCandidates}
                pane="right"
                renderChartTab={renderChartTab}
                renderPanelTab={renderPanelTab}
                scrollTargetHeading={rightPaneScrollHeading}
                sourceMode={isSourceMode}
                typewriterMode={isTypewriterMode}
                userDefinedFields={userDefinedFields}
                viewRef={rightEditorViewRef}
                workspacePath={workspacePath}
                onCreateFile={onCreateFile}
                onEditorAction={onEditorAction}
                onFileSaveError={onFileSaveError}
                onFileSaved={onFileSaved}
                onFocus={() => onSetFocusedPane("right")}
                onLargeMarkdownFallback={onLargeMarkdownFallback}
                onOpenLink={onOpenLink}
                onOpenWikiLink={onOpenWikiLink}
                onRenameFile={onRenameFile}
                onScrollTargetHandled={() => onScrollTargetHandled("right")}
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
