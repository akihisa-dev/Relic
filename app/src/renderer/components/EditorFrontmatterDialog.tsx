import type { ReactElement } from "react";

import type { FrontmatterDialogRequest } from "../editorFrontmatter";
import type { Translator } from "../i18n";

interface EditorFrontmatterDialogProps {
  candidates: string[];
  dialog: FrontmatterDialogRequest | null;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  t: Translator;
  value: string;
}

export function EditorFrontmatterDialog({
  candidates,
  dialog,
  error,
  onCancel,
  onSubmit,
  onValueChange,
  t,
  value
}: EditorFrontmatterDialogProps): ReactElement | null {
  if (!dialog) return null;

  return (
    <div className="frontmatter-add-dialog" role="dialog" aria-modal="true">
      <div className="frontmatter-add-dialog-title">
        {dialog.type === "property" ? t("frontmatter.addProperty") : t("frontmatter.addValueToField", { field: dialog.key })}
      </div>
      <input
        autoFocus
        className="frontmatter-add-dialog-input"
        list={candidates.length > 0 ? "frontmatter-add-dialog-candidates" : undefined}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
          if (event.key === "Escape") onCancel();
        }}
        placeholder={dialog.type === "property" ? t("frontmatter.propertyName") : t("frontmatter.value")}
        type="text"
        value={value}
      />
      {candidates.length > 0 ? (
        <datalist id="frontmatter-add-dialog-candidates">
          {candidates.map((candidate) => (
            <option key={candidate} value={candidate} />
          ))}
        </datalist>
      ) : null}
      {error ? <div className="frontmatter-add-dialog-error">{error}</div> : null}
      <div className="frontmatter-add-dialog-actions">
        <button onClick={onCancel} type="button">{t("common.cancel")}</button>
        <button onClick={onSubmit} type="button">{t("frontmatter.addField")}</button>
      </div>
    </div>
  );
}
