import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { hasInvalidFrontmatterYaml } from "../editorFrontmatter";
import { isLargeMarkdownContent } from "../largeMarkdown";
import { textCount } from "../paneViewModel";
import type { PanelTabKind, Tab } from "../store/editorStore";
import { useT } from "../i18n";
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
  onCreateFile: (name: string) => void;
  onEditorAction?: () => void;
  onLoadExternalVersion: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onRenameFile: (path: string, name: string) => void;
  onSaveRelicVersion: () => void;
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
  onLoadExternalVersion,
  onOpenLink,
  onOpenWikiLink,
  onRenameFile,
  onSaveRelicVersion,
  onUpdateTabContent
}: PaneContentSurfaceProps): ReactElement {
  const t = useT();

  if (activeTab?.kind === "file") {
    const { chars, words } = textCount(activeTab.content);
    const isLargeMarkdown = isLargeMarkdownContent(activeTab.content);
    const hasInvalidFrontmatter = hasInvalidFrontmatterYaml(activeTab.content);

    return (
      <div
        className={`editor-surface${editorActionPulse > 0 ? ` editor-surface--action-${editorActionPulse % 2 === 0 ? "even" : "odd"}` : ""}`}
      >
        <div className="editor-body">
          <EditableFileTitle
            maxWidth={editorSettings.maxWidth === "none" ? undefined : editorSettings.maxWidth}
            name={activeTab.name}
            onRename={(name) => onRenameFile(activeTab.path, name)}
          />
          {activeTab.externalConflict ? (
            <div
              className="editor-conflict-banner"
              role="status"
              style={{ maxWidth: editorSettings.maxWidth === "none" ? undefined : editorSettings.maxWidth }}
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
            </div>
          ) : null}
          {isLargeMarkdown ? (
            <div
              className="editor-conflict-banner"
              role="status"
              style={{ maxWidth: editorSettings.maxWidth === "none" ? undefined : editorSettings.maxWidth }}
            >
              <span>{t("pane.largeMarkdown")}</span>
            </div>
          ) : null}
          {hasInvalidFrontmatter ? (
            <div
              className="editor-conflict-banner"
              role="status"
              style={{ maxWidth: editorSettings.maxWidth === "none" ? undefined : editorSettings.maxWidth }}
            >
              <span>{t("frontmatter.invalidYamlBanner")}</span>
            </div>
          ) : null}
          <Editor
            allFilePaths={allFilePaths}
            content={activeTab.content}
            frontmatterCandidates={frontmatterCandidates}
            key={activeTab.id}
            onChange={(content) => onUpdateTabContent(activeTab.id, content)}
            onOpenLink={onOpenLink}
            onOpenWikiLink={onOpenWikiLink}
            settings={editorSettings}
            sourceMode={sourceMode || isLargeMarkdown}
            typewriterMode={typewriterMode}
            userDefinedFields={userDefinedFields}
            viewRef={viewRef}
            onEditorAction={onEditorAction}
          />
        </div>
        <div className="pane-status">
          <span>{t("app.wordCount", { chars, words })}</span>
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
          <button className="primary-button" onClick={() => onCreateFile("")} type="button">
            {t("pane.createFile")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface EditableFileTitleProps {
  maxWidth?: string;
  name: string;
  onRename: (name: string) => void;
}

function EditableFileTitle({ maxWidth, name, onRename }: EditableFileTitleProps): ReactElement {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(name);
    setEditing(false);
  }, [name]);

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
        style={{ maxWidth }}
      >
        <input
          autoFocus
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
      style={{ maxWidth }}
      type="button"
    >
      {name}
    </button>
  );
}
