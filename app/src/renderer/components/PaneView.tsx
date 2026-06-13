import { EditorView } from "@codemirror/view";
import type { MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { FileTab } from "../store/editorStore";
import type { HeadingScrollTarget } from "../editorDerivedState";
import { usePaneHeadingScroll } from "../hooks/usePaneHeadingScroll";
import { useEditorStore, type PaneId, type PanelTabKind } from "../store/editorStore";
import { PaneContentSurface } from "./PaneContentSurface";
import { PaneTabs } from "./PaneTabs";

export interface PaneViewProps {
  allFilePaths: string[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  closingTabIds: Set<string>;
  isSplitView: boolean;
  pane: PaneId;
  scrollTargetHeading?: HeadingScrollTarget;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
  viewRef: MutableRefObject<EditorView | null>;
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  onCloseAllTabs: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onCreateFile: (name: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onEditorAction?: () => void;
  onFocus: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onFileSaved?: (path: string) => void;
  onFileSaveError?: (message: string) => void;
  onLargeMarkdownFallback?: (name: string, path: string) => void;
  onOpenFile: (path: string) => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onPrintPreview: (tab: FileTab) => void;
  onRevealTabFile?: (tabId: string) => void;
  onSavePreviewAsPdf: (tab: FileTab) => void;
  onScrollTargetHandled?: () => void;
  onSourceModeToggle: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  sourceMode: boolean;
}

export function PaneView({
  allFilePaths,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  closingTabIds,
  isSplitView,
  pane,
  scrollTargetHeading,
  typewriterMode,
  userDefinedFields,
  workspacePath,
  viewRef,
  renderChartTab,
  renderPanelTab,
  renderPanelTabIcon,
  onCloseAllTabs,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCreateFile,
  onDuplicateTabFile,
  onFocus,
  onOpenLink,
  onOpenWikiLink,
  onFileSaved,
  onFileSaveError,
  onLargeMarkdownFallback,
  onOpenFile,
  onOpenInOtherPane,
  onRenameFile,
  onPrintPreview,
  onRevealTabFile,
  onSavePreviewAsPdf,
  onScrollTargetHandled,
  onSourceModeToggle,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
  onEditorAction,
  sourceMode
}: PaneViewProps): ReactElement {
  const {
    leftPane,
    markTabSaved,
    resolveTabExternalConflict,
    rightPane,
    tabs,
    updateTabContent
  } = useEditorStore();
  const paneState = pane === "left" ? leftPane : rightPane;
  const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

  const loadExternalVersion = (): void => {
    if (activeTab?.kind !== "file") return;
    resolveTabExternalConflict(activeTab.id, "external");
  };

  const saveRelicVersion = (): void => {
    if (activeTab?.kind !== "file" || !window.relic) return;

    void window.relic.writeMarkdownFile({ content: activeTab.content, path: activeTab.path }).then((result) => {
      if (result.ok) {
        resolveTabExternalConflict(activeTab.id, "relic");
        markTabSaved(activeTab.id, activeTab.content);
        onFileSaved?.(activeTab.path);
        return;
      }

      onFileSaveError?.(result.error.message);
    }).catch((error) => {
      onFileSaveError?.(error instanceof Error ? error.message : String(error));
    });
  };

  usePaneHeadingScroll({
    onScrollTargetHandled,
    scrollTargetHeading,
    viewRef
  });

  return (
    <div
      className={`pane${focusedPane === pane ? " pane--focused" : ""}`}
      onClick={onFocus}
      onFocusCapture={onFocus}
      onPointerDownCapture={onFocus}
      role="presentation"
    >
      <PaneTabs
        closingTabIds={closingTabIds}
        isSplitView={isSplitView}
        pane={pane}
        paneState={paneState}
        renderPanelTabIcon={renderPanelTabIcon}
        tabs={tabs}
        onCloseAllTabs={onCloseAllTabs}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseTabsToRight={onCloseTabsToRight}
        onDuplicateTabFile={onDuplicateTabFile}
        onOpenInOtherPane={onOpenInOtherPane}
        onPrintPreview={onPrintPreview}
        onRevealTabFile={onRevealTabFile}
        onSavePreviewAsPdf={onSavePreviewAsPdf}
        onTabClose={onTabClose}
        onTabMove={onTabMove}
        onTabSelect={onTabSelect}
        onTogglePinTab={onTogglePinTab}
      />
      <PaneContentSurface
        activeTab={activeTab}
        allFilePaths={allFilePaths}
        editorActionPulse={editorActionPulse}
        editorSettings={editorSettings}
        frontmatterCandidates={frontmatterCandidates}
        renderChartTab={renderChartTab}
        renderPanelTab={renderPanelTab}
        sourceMode={sourceMode}
        onSourceModeToggle={onSourceModeToggle}
        typewriterMode={typewriterMode}
        userDefinedFields={userDefinedFields}
        viewRef={viewRef}
        workspacePath={workspacePath}
        onCreateFile={onCreateFile}
        onEditorAction={onEditorAction}
        onLargeMarkdownFallback={onLargeMarkdownFallback}
        onLoadExternalVersion={loadExternalVersion}
        onOpenFile={onOpenFile}
        onOpenLink={onOpenLink}
        onOpenWikiLink={onOpenWikiLink}
        onRenameFile={onRenameFile}
        onSaveRelicVersion={saveRelicVersion}
        onUpdateTabContent={updateTabContent}
      />
    </div>
  );
}
