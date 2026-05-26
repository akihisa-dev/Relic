import { EditorView } from "@codemirror/view";
import type { MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { usePaneHeadingScroll } from "../hooks/usePaneHeadingScroll";
import { useEditorStore, type PaneId, type PanelTabKind } from "../store/editorStore";
import { PaneContentSurface } from "./PaneContentSurface";

export interface PaneViewProps {
  allFilePaths: string[];
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
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  onCreateFile: (name: string) => void;
  onEditorAction?: () => void;
  onFocus: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onFileSaved?: (path: string) => void;
  onFileSaveError?: (message: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onScrollTargetHandled?: () => void;
  isSplitView: boolean;
  sourceMode: boolean;
}

export function PaneView({
  allFilePaths,
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
  renderChartTab,
  renderPanelTab,
  onCreateFile,
  onFocus,
  onOpenLink,
  onOpenWikiLink,
  onFileSaved,
  onFileSaveError,
  onRenameFile,
  onScrollTargetHandled,
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
  void isSplitView;

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
    >
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
