import type { ReactElement } from "react";

import type { FrontmatterDialogRequest } from "../editorFrontmatter";

interface EditorFrontmatterDialogProps {
  candidates: string[];
  dialog: FrontmatterDialogRequest | null;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  value: string;
}

export function EditorFrontmatterDialog({
  candidates,
  dialog,
  error,
  onCancel,
  onSubmit,
  onValueChange,
  value
}: EditorFrontmatterDialogProps): ReactElement | null {
  if (!dialog) return null;

  return (
    <div className="frontmatter-add-dialog" role="dialog" aria-modal="true">
      <div className="frontmatter-add-dialog-title">
        {dialog.type === "property" ? "プロパティを追加" : `${dialog.key} に値を追加`}
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
        placeholder={dialog.type === "property" ? "プロパティ名" : "値"}
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
        <button onClick={onCancel} type="button">キャンセル</button>
        <button onClick={onSubmit} type="button">追加</button>
      </div>
    </div>
  );
}
