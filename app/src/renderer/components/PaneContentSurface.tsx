import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { clearLocalEditorContentEcho, markLocalEditorContentEcho } from "../editorContentEcho";
import { updateFrontmatterValidation, type FrontmatterValidationSnapshot } from "../editorFrontmatter";
import {
  bufferEditorChange,
  discardPendingEditorChanges,
  flushPendingEditorChanges,
  type BufferedEditorChange
} from "../editorInputBuffer";
import { isLargeMarkdownContent } from "../largeMarkdown";
import { updateTextCount, type TextCountSnapshot } from "../paneViewModel";
import { useEditorStore, type PaneId, type PanelTabKind, type Tab } from "../store/editorStore";
import { useT } from "../i18n";
import { SourceModeButton } from "./AppMainActions";
import { EditableFileTitle } from "./EditableFileTitle";
import { Editor } from "./Editor";
import { ImageTabSurface, PdfTabSurface } from "./PaneAttachmentSurfaces";

interface PaneContentSurfaceProps {
  activeTab: Tab | null | undefined;
  allFilePaths: string[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  frontmatterCandidates: Record<string, string[]>;
  pane?: PaneId;
  renderChartTab: (chartId: string, pane?: PaneId) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  sourceMode: boolean;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  viewRef: MutableRefObject<EditorView | null>;
  workspacePath?: string | null;
  workspaceDataRevision?: number;
  onCreateFile: (name: string) => void;
  onEditorAction?: () => void;
  onLoadExternalVersion: () => void;
  onLargeMarkdownFallback?: (name: string, path: string) => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onSaveRelicVersion: () => void;
  onSourceModeToggle: () => void;
  onUpdateTabContent: (tabId: string, content: string) => void;
}

export function PaneContentSurface({
  activeTab,
  allFilePaths,
  editorActionPulse,
  editorSettings,
  frontmatterCandidates,
  pane = "left",
  renderChartTab,
  renderPanelTab,
  sourceMode,
  typewriterMode,
  userDefinedFields,
  viewRef,
  workspacePath,
  workspaceDataRevision = 0,
  onCreateFile,
  onEditorAction,
  onLargeMarkdownFallback,
  onLoadExternalVersion,
  onOpenLink,
  onOpenWikiLink,
  onRenameFile,
  onSaveRelicVersion,
  onSourceModeToggle,
  onUpdateTabContent
}: PaneContentSurfaceProps): ReactElement {
  const t = useT();
  const notifiedLargeMarkdownFallbacksRef = useRef<Set<string> | null>(null);
  if (notifiedLargeMarkdownFallbacksRef.current === null) {
    notifiedLargeMarkdownFallbacksRef.current = new Set();
  }
  const notifiedLargeMarkdownFallbacks = notifiedLargeMarkdownFallbacksRef.current;
  const activeFileTab = activeTab?.kind === "file" ? activeTab : null;
  const activeFileContent = activeFileTab?.content ?? "";
  const isLargeMarkdown = useMemo(() => isLargeMarkdownContent(activeFileContent), [activeFileContent]);
  const textCountSnapshotRef = useRef<TextCountSnapshot | null>(null);
  const textCountResult = activeFileTab
    ? updateTextCount(textCountSnapshotRef.current, activeFileTab.content)
    : null;
  textCountSnapshotRef.current = textCountResult;
  const frontmatterValidationRef = useRef<FrontmatterValidationSnapshot | null>(null);
  const frontmatterValidation = activeFileTab
    ? updateFrontmatterValidation(frontmatterValidationRef.current, activeFileTab.content)
    : null;
  frontmatterValidationRef.current = frontmatterValidation;
  const activeContentEchoKey = activeFileTab ? editorContentEchoKey(pane, activeFileTab.id) : null;
  const [frontmatterAddButtonHost, setFrontmatterAddButtonHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeFileTab) return;
    const tabId = activeFileTab.id;
    return () => {
      flushPendingEditorChanges([tabId]);
      clearLocalEditorContentEcho(editorContentEchoKey(pane, tabId));
    };
  }, [activeFileTab?.id]);

  useEffect(() => {
    if (!activeFileTab || !isLargeMarkdown) return;

    const notificationKey = `${activeFileTab.id}:${activeFileTab.path}`;
    if (notifiedLargeMarkdownFallbacks.has(notificationKey)) return;

    notifiedLargeMarkdownFallbacks.add(notificationKey);
    onLargeMarkdownFallback?.(activeFileTab.name, activeFileTab.path);
  }, [activeFileTab, isLargeMarkdown, notifiedLargeMarkdownFallbacks, onLargeMarkdownFallback]);

  if (activeFileTab) {
    const hasInvalidFrontmatter = frontmatterValidation?.invalid ?? false;
    const editorContentMaxWidth = editorSettings.maxWidth === "none" ? undefined : editorSettings.maxWidth;
    const editorTitleRowStyle = {
      "--editor-file-title-max-width": editorContentMaxWidth ?? "100%"
    } as CSSProperties;

    return (
      <div
        className={`editor-surface${editorActionPulse > 0 ? ` editor-surface--action-${editorActionPulse % 2 === 0 ? "even" : "odd"}` : ""}`}
      >
        <div className="editor-body">
          <div className="editor-file-title-row" style={editorTitleRowStyle}>
            <div className="editor-file-title-slot">
              <EditableFileTitle
                key={activeFileTab.id}
                name={activeFileTab.name}
                onRename={(name) => onRenameFile(activeFileTab.path, name)}
              />
            </div>
            <div className="editor-file-title-actions">
              <SourceModeButton
                isSourceMode={sourceMode}
                onSourceModeToggle={onSourceModeToggle}
              />
              <div className="editor-file-title-frontmatter-action" ref={setFrontmatterAddButtonHost} />
            </div>
          </div>
          {activeFileTab.externalConflict ? (
            <output
              className="editor-conflict-banner"
              style={{ maxWidth: editorContentMaxWidth }}
            >
              <span>{t("pane.externalConflict")}</span>
              <div className="editor-conflict-actions">
                <button className="secondary-button" onClick={onLoadExternalVersion} type="button">
                  {t("pane.loadExternalVersion")}
                </button>
                <button className="secondary-button" onClick={onSaveRelicVersion} type="button">
                  {t("pane.saveRelicVersion")}
                </button>
              </div>
            </output>
          ) : null}
          {isLargeMarkdown ? (
            <output
              className="editor-conflict-banner"
              style={{ maxWidth: editorContentMaxWidth }}
            >
              <span>{t("pane.largeMarkdown")}</span>
            </output>
          ) : null}
          {hasInvalidFrontmatter ? (
            <output
              className="editor-conflict-banner"
              style={{ maxWidth: editorContentMaxWidth }}
            >
              <span>{t("frontmatter.invalidYamlBanner")}</span>
            </output>
          ) : null}
          <Editor
            allFilePaths={allFilePaths}
            content={activeFileTab.content}
            contentEchoKey={activeContentEchoKey ?? undefined}
            filePath={activeFileTab.path}
            frontmatterCandidates={frontmatterCandidates}
            key={activeFileTab.id}
            onChange={(content) => {
              discardPendingEditorChanges([activeFileTab.id]);
              markLocalEditorContentEcho(editorContentEchoKey(pane, activeFileTab.id), content);
              onUpdateTabContent(activeFileTab.id, content);
            }}
            onTypingChange={(content) => {
              bufferEditorChange({
                content,
                filePath: activeFileTab.path,
                tabId: activeFileTab.id,
                commit: (change) => commitBufferedEditorChange(change, pane)
              });
            }}
            onOpenLink={onOpenLink}
            onOpenWikiLink={onOpenWikiLink}
            settings={editorSettings}
            sourceMode={sourceMode || isLargeMarkdown}
            frontmatterAddButtonHost={frontmatterAddButtonHost}
            typewriterMode={typewriterMode}
            userDefinedFields={userDefinedFields}
            viewRef={viewRef}
            workspacePath={workspacePath}
            workspaceRevision={workspaceDataRevision}
            onEditorAction={onEditorAction}
          />
        </div>
        <div className="pane-status">
          <span>
            {t("app.wordCount", { chars: textCountResult?.chars ?? 0, words: textCountResult?.words ?? 0 })}
          </span>
        </div>
      </div>
    );
  }

  if (activeTab?.kind === "panel") {
    return (
      <div className="editor-surface panel-tab-surface">
        <div className="panel-tab-body">
          {renderPanelTab(activeTab.panel)}
        </div>
      </div>
    );
  }

  if (activeTab?.kind === "image") {
    return <ImageTabSurface name={activeTab.name} path={activeTab.path} refreshRevision={workspaceDataRevision} />;
  }

  if (activeTab?.kind === "pdf") {
    return <PdfTabSurface name={activeTab.name} path={activeTab.path} refreshRevision={workspaceDataRevision} />;
  }

  if (activeTab?.kind === "chart") {
    return (
      <div className="editor-surface panel-tab-surface">
        <div className="panel-tab-body">
          {renderChartTab(activeTab.chartId, pane)}
        </div>
      </div>
    );
  }

  return (
    <div className="empty-pane">
      <div className="empty-pane-copy">
        <p className="empty-pane-kicker">{t("pane.emptyKicker")}</p>
        <p className="empty-pane-message">{t("pane.noFiles")}</p>
      </div>
      {workspacePath ? (
        <div className="empty-pane-form">
          <button className="empty-pane-create-button" onClick={() => onCreateFile("")} type="button">
            {t("pane.createFile")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function editorContentEchoKey(pane: PaneId, tabId: string): string {
  return `${pane}:${tabId}`;
}

function commitBufferedEditorChange(change: BufferedEditorChange, pane: PaneId): void {
  const tab = useEditorStore.getState().tabs[change.tabId];
  if (tab?.kind !== "file" || tab.path !== change.filePath) return;
  markLocalEditorContentEcho(editorContentEchoKey(pane, change.tabId), change.content);
  useEditorStore.getState().updateTabContent(change.tabId, change.content);
}
