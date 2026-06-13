import { EditorView } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent, MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { isRelicMapMarkdownContent } from "../../shared/mapMarkdown";
import { hasInvalidFrontmatterYaml } from "../editorFrontmatter";
import { isLargeMarkdownContent } from "../largeMarkdown";
import { textCount } from "../paneViewModel";
import type { PanelTabKind, Tab } from "../store/editorStore";
import { useT } from "../i18n";
import { SourceModeButton } from "./AppMainActions";
import { Editor } from "./Editor";
import { MapCanvas, mapCanvasStatus } from "./MapCanvas";

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
  onCreateFile: (name: string) => void;
  onEditorAction?: () => void;
  onLoadExternalVersion: () => void;
  onLargeMarkdownFallback?: (name: string, path: string) => void;
  onOpenFile: (path: string) => void;
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
  onCreateFile,
  onEditorAction,
  onLargeMarkdownFallback,
  onLoadExternalVersion,
  onOpenFile,
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
  const isLargeMarkdown = activeFileTab ? isLargeMarkdownContent(activeFileTab.content) : false;
  const isMapMarkdown = activeFileTab ? isRelicMapMarkdownContent(activeFileTab.content) : false;
  const [frontmatterAddButtonHost, setFrontmatterAddButtonHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeFileTab || !isLargeMarkdown) return;

    const notificationKey = `${activeFileTab.id}:${activeFileTab.path}`;
    if (notifiedLargeMarkdownFallbacks.has(notificationKey)) return;

    notifiedLargeMarkdownFallbacks.add(notificationKey);
    onLargeMarkdownFallback?.(activeFileTab.name, activeFileTab.path);
  }, [activeFileTab, isLargeMarkdown, notifiedLargeMarkdownFallbacks, onLargeMarkdownFallback]);

  if (activeFileTab) {
    const { chars, words } = textCount(activeFileTab.content);
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
          {isMapMarkdown && !sourceMode ? (
            <MapCanvas
              content={activeFileTab.content}
              fileName={activeFileTab.name}
              onChange={(content) => onUpdateTabContent(activeFileTab.id, content)}
              onOpenFile={onOpenFile}
            />
          ) : (
            <Editor
              allFilePaths={allFilePaths}
              content={activeFileTab.content}
              filePath={activeFileTab.path}
              frontmatterCandidates={frontmatterCandidates}
              key={activeFileTab.id}
              onChange={(content) => onUpdateTabContent(activeFileTab.id, content)}
              onOpenLink={onOpenLink}
              onOpenWikiLink={onOpenWikiLink}
              settings={editorSettings}
              sourceMode={sourceMode || isLargeMarkdown}
              frontmatterAddButtonHost={frontmatterAddButtonHost}
              typewriterMode={typewriterMode}
              userDefinedFields={userDefinedFields}
              viewRef={viewRef}
              onEditorAction={onEditorAction}
            />
          )}
        </div>
        <div className="pane-status">
          <span>{isMapMarkdown && !sourceMode ? mapCanvasStatus(activeFileTab.content, t) : t("app.wordCount", { chars, words })}</span>
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

interface EditableFileTitleProps {
  name: string;
  onRename: (name: string) => void;
}

function EditableFileTitle({ name, onRename }: EditableFileTitleProps): ReactElement {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const t = useT();

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
