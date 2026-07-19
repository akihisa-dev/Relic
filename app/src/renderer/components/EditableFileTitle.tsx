import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactElement } from "react";

import { useT } from "../i18n";

interface EditableFileTitleProps {
  name: string;
  onRename: (name: string) => void;
}

export function EditableFileTitle({ name, onRename }: EditableFileTitleProps): ReactElement {
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const t = useT();

  useEffect(() => {
    if (!editing) setDraft(name);
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
    <button className="editor-file-title editor-file-title-button" onClick={() => setEditing(true)} type="button">
      {name}
    </button>
  );
}
