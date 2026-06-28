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
import { PaneView, type PaneViewProps } from "./PaneView";

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

type CommonPaneViewProps = Omit<
  PaneViewProps,
  | "closingTabIds"
  | "editorActionPulse"
  | "onFocus"
  | "onScrollTargetHandled"
  | "onSourceModeToggle"
  | "pane"
  | "scrollTargetHeading"
  | "sourceMode"
  | "viewRef"
>;

function paneViewProps(
  common: CommonPaneViewProps,
  options: {
    closingTabIds: Set<string>;
    editorActionPulse: number;
    focusedPane: PaneId;
    onScrollTargetHandled: (pane: PaneId) => void;
    onSetFocusedPane: (pane: PaneId) => void;
    onSourceModeToggle: (pane: PaneId) => void;
    pane: PaneId;
    scrollTargetHeading?: HeadingScrollTarget;
    sourceMode: boolean;
    viewRef: MutableRefObject<EditorView | null>;
  }
): PaneViewProps {
  return {
    ...common,
    closingTabIds: options.closingTabIds,
    editorActionPulse: options.focusedPane === options.pane ? options.editorActionPulse : 0,
    onFocus: () => options.onSetFocusedPane(options.pane),
    onScrollTargetHandled: () => options.onScrollTargetHandled(options.pane),
    onSourceModeToggle: () => options.onSourceModeToggle(options.pane),
    pane: options.pane,
    scrollTargetHeading: options.scrollTargetHeading,
    sourceMode: options.sourceMode,
    viewRef: options.viewRef
  };
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

  const commonPaneViewProps: CommonPaneViewProps = {
    allFilePaths,
    editorSettings,
    focusedPane,
    frontmatterCandidates,
    isSplitView: isSplit,
    onCloseAllTabs: onCloseAllTabsInPane,
    onCloseOtherTabs,
    onCloseTabsToRight,
    onCreateFile,
    onDuplicateTabFile,
    onEditorAction,
    onFileSaveError,
    onFileSaved,
    onLargeMarkdownFallback,
    onOpenInOtherPane,
    onOpenLink,
    onOpenWikiLink,
    onRenameFile,
    onRevealTabFile,
    onSavePreviewAsPdf,
    onTabClose,
    onTabMove,
    onTabSelect,
    onTogglePinTab,
    renderChartTab,
    renderPanelTab,
    renderPanelTabIcon,
    typewriterMode: isTypewriterMode,
    userDefinedFields,
    workspacePath
  };
  const leftPaneViewProps = paneViewProps(commonPaneViewProps, {
    closingTabIds: leftClosingTabIds,
    editorActionPulse,
    focusedPane,
    onScrollTargetHandled,
    onSetFocusedPane,
    onSourceModeToggle,
    pane: "left",
    scrollTargetHeading: leftPaneScrollHeading,
    sourceMode: isLeftSourceMode,
    viewRef: leftEditorViewRef
  });
  const rightPaneViewProps = paneViewProps(commonPaneViewProps, {
    closingTabIds: rightClosingTabIds,
    editorActionPulse,
    focusedPane,
    onScrollTargetHandled,
    onSetFocusedPane,
    onSourceModeToggle,
    pane: "right",
    scrollTargetHeading: rightPaneScrollHeading,
    sourceMode: isRightSourceMode,
    viewRef: rightEditorViewRef
  });

  return (
    <main className="main-area">
      <div className="editor-layout">
        <div className="editor-workspace">
          <div className={`panes-container${isSplit ? " panes-container--split" : ""}${isSplitClosing ? " panes-container--closing-split" : ""}`}>
            <PaneView {...leftPaneViewProps} />
            {isSplit ? (
              <PaneView {...rightPaneViewProps} />
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
