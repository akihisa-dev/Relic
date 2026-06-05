import { EditorView } from "@codemirror/view";
import type { MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import type { HeadingScrollTarget } from "../editorDerivedState";
import { usePaneHeadingScroll } from "../hooks/usePaneHeadingScroll";
import { useEditorStore, type FileTab, type PaneId, type PanelTabKind } from "../store/editorStore";
import { PaneContentSurface } from "./PaneContentSurface";
import { PaneTabs } from "./PaneTabs";

export interface PaneViewProps {
  allFilePaths: string[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  focusedPane: PaneId;
  frontmatterCandidates: Record<string, string[]>;
  closingTabIds: Set<string>;
  pane: PaneId;
  scrollTargetHeading?: HeadingScrollTarget;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  workspacePath?: string | null;
  viewRef: MutableRefObject<EditorView | null>;
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  onCloseAllTabsInPane: (pane: PaneId) => void;
  onCloseOtherTabs: (pane: PaneId, tabId: string) => void;
  onCloseTabsToRight: (pane: PaneId, tabId: string) => void;
  onCreateFile: (name: string) => void;
  onDuplicateTabFile?: (tabId: string) => void;
  onEditorAction?: () => void;
  onFocus: () => void;
  onOpenInOtherPane: (pane: PaneId, tabId: string) => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onFileSaved?: (path: string) => void;
  onFileSaveError?: (message: string) => void;
  onLargeMarkdownFallback?: (name: string, path: string) => void;
  onPrintPreview: (tab: FileTab) => void;
  onRevealTabFile?: (tabId: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onSavePreviewAsPdf: (tab: FileTab) => void;
  onScrollTargetHandled?: () => void;
  onTabClose: (pane: PaneId, tabId: string) => void;
  onTabMove: (fromPane: PaneId, toPane: PaneId, tabId: string, targetTabId?: string | null, position?: "before" | "after") => void;
  onTabSelect: (pane: PaneId, tabId: string) => void;
  onTogglePinTab?: (tabId: string) => void;
  isSplitView: boolean;
  sourceMode: boolean;
}

export function PaneView({
  allFilePaths,
  editorActionPulse,
  editorSettings,
  focusedPane,
  frontmatterCandidates,
  closingTabIds,
  pane,
  scrollTargetHeading,
  typewriterMode,
  userDefinedFields,
  workspacePath,
  viewRef,
  renderChartTab,
  renderPanelTab,
  renderPanelTabIcon,
  onCloseAllTabsInPane,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCreateFile,
  onDuplicateTabFile,
  onFocus,
  onOpenInOtherPane,
  onOpenLink,
  onOpenWikiLink,
  onFileSaved,
  onFileSaveError,
  onLargeMarkdownFallback,
  onPrintPreview,
  onRevealTabFile,
  onRenameFile,
  onSavePreviewAsPdf,
  onScrollTargetHandled,
  onTabClose,
  onTabMove,
  onTabSelect,
  onTogglePinTab,
  onEditorAction,
  isSplitView,
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
        onCloseAllTabs={onCloseAllTabsInPane}
        onCloseOtherTabs={onCloseOtherTabs}
        onCloseTabsToRight={onCloseTabsToRight}
        onCreateTab={() => onCreateFile("")}
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
        typewriterMode={typewriterMode}
        userDefinedFields={userDefinedFields}
        viewRef={viewRef}
        workspacePath={workspacePath}
        onCreateFile={onCreateFile}
        onEditorAction={onEditorAction}
        onLargeMarkdownFallback={onLargeMarkdownFallback}
        onLoadExternalVersion={loadExternalVersion}
        onOpenLink={onOpenLink}
        onOpenWikiLink={onOpenWikiLink}
        onRenameFile={onRenameFile}
        onSaveRelicVersion={saveRelicVersion}
        onUpdateTabContent={updateTabContent}
      />
    </div>
  );
}
