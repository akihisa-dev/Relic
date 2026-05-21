import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, MutableRefObject, ReactElement, ReactNode } from "react";

import type { EditorSettings, UserDefinedField } from "../../shared/ipc";
import { textCount } from "../paneViewModel";
import type { PanelTabKind, Tab } from "../store/editorStore";
import { useT } from "../i18n";
import { Editor } from "./Editor";

interface PaneContentSurfaceProps {
  activeTab: Tab | null | undefined;
  allCardPaths: string[];
  editorActionPulse: number;
  editorSettings: EditorSettings;
  frontmatterCandidates: Record<string, string[]>;
  renderTimelineTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
  sourceMode: boolean;
  typewriterMode: boolean;
  userDefinedFields: UserDefinedField[];
  viewRef: MutableRefObject<EditorView | null>;
  cardbookPath?: string | null;
  onCreateCard: (name: string) => void;
  onEditorAction?: () => void;
  onOpenLink?: (href: string) => void;
  onOpenWikiLink?: (target: string, heading?: string) => void;
  onRenameCard: (path: string, name: string) => void;
  onUpdateTabContent: (tabId: string, content: string) => void;
}

export function PaneContentSurface({
  activeTab,
  allCardPaths,
  editorActionPulse,
  editorSettings,
  frontmatterCandidates,
  renderTimelineTab,
  renderPanelTab,
  sourceMode,
  typewriterMode,
  userDefinedFields,
  viewRef,
  cardbookPath,
  onCreateCard,
  onEditorAction,
  onOpenLink,
  onOpenWikiLink,
  onRenameCard,
  onUpdateTabContent
}: PaneContentSurfaceProps): ReactElement {
  const t = useT();

  if (activeTab?.kind === "card") {
    const { chars, words } = textCount(activeTab.content);

    return (
      <div
        className={`editor-surface${editorActionPulse > 0 ? ` editor-surface--action-${editorActionPulse % 2 === 0 ? "even" : "odd"}` : ""}`}
      >
        <div className="editor-body">
          <EditableCardTitle
            maxWidth={editorSettings.maxWidth === "none" ? undefined : editorSettings.maxWidth}
            name={activeTab.name}
            onRename={(name) => onRenameCard(activeTab.path, name)}
          />
          <Editor
            allCardPaths={allCardPaths}
            content={activeTab.content}
            frontmatterCandidates={frontmatterCandidates}
            key={activeTab.id}
            onChange={(content) => onUpdateTabContent(activeTab.id, content)}
            onOpenLink={onOpenLink}
            onOpenWikiLink={onOpenWikiLink}
            settings={editorSettings}
            sourceMode={sourceMode}
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

  if (activeTab?.kind === "timeline") {
    return (
      <div className="editor-surface panel-tab-surface">
        <div className="panel-tab-body">
          {renderTimelineTab(activeTab.chartId)}
        </div>
      </div>
    );
  }

  return (
    <div className="empty-pane">
      <div className="empty-pane-copy">
        <p className="empty-pane-kicker">{t("pane.emptyKicker")}</p>
        <p className="empty-pane-message">{t("pane.noCards")}</p>
      </div>
      {cardbookPath ? (
        <div className="empty-pane-form">
          <button className="primary-button" onClick={() => onCreateCard("")} type="button">
            {t("pane.createCard")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface EditableCardTitleProps {
  maxWidth?: string;
  name: string;
  onRename: (name: string) => void;
}

function EditableCardTitle({ maxWidth, name, onRename }: EditableCardTitleProps): ReactElement {
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
        className="editor-card-title-form"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          commit();
        }}
        style={{ maxWidth }}
      >
        <input
          autoFocus
          className="editor-card-title editor-card-title-input"
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
      className="editor-card-title editor-card-title-button"
      onClick={() => setEditing(true)}
      style={{ maxWidth }}
      type="button"
    >
      {name}
    </button>
  );
}
