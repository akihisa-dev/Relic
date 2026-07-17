import { relicClient } from "../relicClient";
import { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent, MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { hasInvalidFrontmatterYaml } from "../editorFrontmatter";
import {
  bufferEditorChange,
  discardPendingEditorChanges,
  flushPendingEditorChanges,
  type BufferedEditorChange
} from "../editorInputBuffer";
import { isLargeMarkdownContent } from "../largeMarkdown";
import { textCount } from "../paneViewModel";
import { useEditorStore, type PanelTabKind, type Tab } from "../store/editorStore";
import { useT } from "../i18n";
import { SourceModeButton } from "./AppMainActions";
import { Editor } from "./Editor";

interface PaneContentSurfaceProps {
  activeTab: Tab | null | undefined;
  allFilePaths: string[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  frontmatterCandidates: Record<string, string[]>;
  renderChartTab: (chartId: string) => ReactNode;
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
  const textCountResult = useMemo(() => {
    if (!activeFileTab) return null;
    return textCount(activeFileTab.content);
  }, [activeFileTab?.content]);
  const [frontmatterAddButtonHost, setFrontmatterAddButtonHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeFileTab) return;
    const tabId = activeFileTab.id;
    return () => flushPendingEditorChanges([tabId]);
  }, [activeFileTab?.id]);

  useEffect(() => {
    if (!activeFileTab || !isLargeMarkdown) return;

    const notificationKey = `${activeFileTab.id}:${activeFileTab.path}`;
    if (notifiedLargeMarkdownFallbacks.has(notificationKey)) return;

    notifiedLargeMarkdownFallbacks.add(notificationKey);
    onLargeMarkdownFallback?.(activeFileTab.name, activeFileTab.path);
  }, [activeFileTab, isLargeMarkdown, notifiedLargeMarkdownFallbacks, onLargeMarkdownFallback]);

  if (activeFileTab) {
    const hasInvalidFrontmatter = hasInvalidFrontmatterYaml(activeFileTab.content);
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
            filePath={activeFileTab.path}
            frontmatterCandidates={frontmatterCandidates}
            key={activeFileTab.id}
            onChange={(content) => {
              discardPendingEditorChanges([activeFileTab.id]);
              onUpdateTabContent(activeFileTab.id, content);
            }}
            onTypingChange={(content) => {
              bufferEditorChange({
                content,
                filePath: activeFileTab.path,
                tabId: activeFileTab.id,
                commit: commitBufferedEditorChange
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
          {renderChartTab(activeTab.chartId)}
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

function commitBufferedEditorChange(change: BufferedEditorChange): void {
  const tab = useEditorStore.getState().tabs[change.tabId];
  if (tab?.kind !== "file" || tab.path !== change.filePath) return;
  useEditorStore.getState().updateTabContent(change.tabId, change.content);
}

interface PdfTabSurfaceProps {
  name: string;
  path: string;
  refreshRevision: number;
}

function PdfTabSurface({ name, path, refreshRevision }: PdfTabSurfaceProps): ReactElement {
  const t = useT();
  const [pdfState, setPdfState] = useState<{ error: string | null; path: string; src: string | null } | null>(null);
  const pdfSrc = pdfState?.path === path ? pdfState.src : null;
  const loadError = pdfState?.path === path ? pdfState.error : null;

  useEffect(() => {
    let active = true;

    void relicClient.current?.readPdfFile({ path }).then((result) => {
      if (!active) return;

      if (result.ok) {
        setPdfState({ error: null, path, src: result.value.dataUrl });
        return;
      }

      setPdfState({ error: result.error.message, path, src: null });
    }).catch(() => {
      if (!active) return;
      setPdfState({ error: t("pane.pdfLoadFailed"), path, src: null });
    });

    return () => {
      active = false;
    };
  }, [path, refreshRevision, t]);

  return (
    <div className="editor-surface pdf-tab-surface">
      <div className="image-tab-title-row">
        <div className="editor-file-title-slot">
          <div className="editor-file-title" title={path}>{name}</div>
        </div>
      </div>
      <div className="pdf-tab-body">
        {pdfSrc ? (
          <iframe
            className="pdf-tab-frame"
            sandbox="allow-scripts"
            src={pdfSrc}
            title={name}
          />
        ) : (
          <output className="editor-conflict-banner">
            <span>{loadError ?? t("pane.pdfLoading")}</span>
          </output>
        )}
      </div>
    </div>
  );
}

interface ImageTabSurfaceProps {
  name: string;
  path: string;
  refreshRevision: number;
}

function ImageTabSurface({ name, path, refreshRevision }: ImageTabSurfaceProps): ReactElement {
  const t = useT();
  const [imageState, setImageState] = useState<{ error: string | null; path: string; src: string | null } | null>(null);
  const imageSrc = imageState?.path === path ? imageState.src : null;
  const loadError = imageState?.path === path ? imageState.error : null;

  useEffect(() => {
    let active = true;

    void relicClient.current?.readImageFile({ path }).then((result) => {
      if (!active) return;

      if (result.ok) {
        setImageState({ error: null, path, src: result.value.dataUrl });
        return;
      }

      setImageState({ error: result.error.message, path, src: null });
    }).catch(() => {
      if (!active) return;
      setImageState({ error: t("pane.imageLoadFailed"), path, src: null });
    });

    return () => {
      active = false;
    };
  }, [path, refreshRevision, t]);

  return (
    <div className="editor-surface image-tab-surface">
      <div className="image-tab-title-row">
        <div className="editor-file-title-slot">
          <div className="editor-file-title" title={path}>{name}</div>
        </div>
      </div>
      <div className="image-tab-body">
        {imageSrc ? (
          <img alt={name} className="image-tab-image" src={imageSrc} />
        ) : (
          <output className="editor-conflict-banner">
            <span>{loadError ?? t("pane.imageLoading")}</span>
          </output>
        )}
      </div>
    </div>
  );
}

interface EditableFileTitleProps {
  name: string;
  onRename: (name: string) => void;
}

function EditableFileTitle({ name, onRename }: EditableFileTitleProps): ReactElement {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!editing) {
      setDraft(name);
    }
  }, [editing, name]);

  const commit = (): void => {
    const nextName = draft.trim();
    setEditing(false);

    if (!nextName || nextName === name) {
      setDraft(name);
      return;
    }

    onRename(nextName);
  };

  if (editing) {
    return (
      <form
        className="editor-file-title-form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          commit();
        }}
      >
        <input
          aria-label={t("pane.enterFileName")}
          className="editor-file-title editor-file-title-input"
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          value={draft}
        />
      </form>
    );
  }

  return (
    <button
      className="editor-file-title editor-file-title-button"
      onClick={() => setEditing(true)}
      type="button"
    >
      {name}
    </button>
  );
}
