import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import type { RightPanelView } from "../store/uiStore";

interface AppTopBarProps {
  activeFileName: string | null;
  isRightPanelOpen: boolean;
  isSourceMode: boolean;
  isSplit: boolean;
  onMoveActiveFile: (destinationFolder: string) => void;
  onRenameActiveFile: (name: string) => void;
  onRightPanelViewButton: (view: RightPanelView) => void;
  onSourceModeToggle: () => void;
  onSplitToggle: () => void;
  rightPanelView: RightPanelView;
  showRightPanelControls: boolean;
}

export function AppTopBar({
  activeFileName,
  isRightPanelOpen,
  isSourceMode,
  isSplit,
  onMoveActiveFile,
  onRenameActiveFile,
  onRightPanelViewButton,
  onSourceModeToggle,
  onSplitToggle,
  rightPanelView,
  showRightPanelControls
}: AppTopBarProps): ReactElement {
  const t = useT();

  return (
    <div className="main-area-top-bar">
      {activeFileName ? (
        <>
          <RenameBar
            name={activeFileName}
            onRename={onRenameActiveFile}
          />
          <MoveBar onMove={onMoveActiveFile} />
        </>
      ) : null}
      <div className="main-area-top-actions">
        <button
          className={`toolbar-btn${isSourceMode ? " active" : ""}`}
          onClick={onSourceModeToggle}
          title={t("pane.sourceMode")}
          type="button"
        >
          {t("pane.sourceShort")}
        </button>
        <button
          className={`toolbar-btn${isSplit ? " active" : ""}`}
          onClick={onSplitToggle}
          title={t("pane.split")}
          type="button"
        >
          {t("pane.splitShort")}
        </button>
        {showRightPanelControls ? (
          <>
            <button
              className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
              onClick={() => onRightPanelViewButton("outline")}
              title={t("pane.toggleOutline")}
              type="button"
            >
              {t("pane.outline")}
            </button>
            <button
              className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
              onClick={() => onRightPanelViewButton("links")}
              title={t("pane.toggleLinks")}
              type="button"
            >
              {t("pane.links")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function RenameBar({ name, onRename }: { name: string; onRename: (value: string) => void }): ReactElement {
  const t = useT();
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(name);
    setEditing(false);
  }, [name]);

  if (!editing) {
    return (
      <button
        className="rename-bar-label"
        onClick={() => setEditing(true)}
        title={t("pane.rename")}
        type="button"
      >
        {name}
      </button>
    );
  }

  return (
    <form
      className="rename-bar-form"
      onSubmit={(event) => {
        event.preventDefault();
        onRename(draft);
        setEditing(false);
      }}
    >
      <input
        autoFocus
        className="rename-bar-input"
        onBlur={() => {
          onRename(draft);
          setEditing(false);
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
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

function MoveBar({ onMove }: { onMove: (destinationFolder: string) => void }): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        className="toolbar-btn"
        onClick={() => setOpen(true)}
        title={t("pane.moveToFolder")}
        type="button"
      >
        {t("pane.moveShort")}
      </button>
    );
  }

  return (
    <form
      className="rename-bar-form"
      onSubmit={(event) => {
        event.preventDefault();
        onMove(draft);
        setDraft("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        className="rename-bar-input"
        onBlur={() => setOpen(false)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft("");
            setOpen(false);
          }
        }}
        placeholder={t("pane.moveDestination")}
        value={draft}
      />
    </form>
  );
}
