import { useId, type FormEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";

interface WorkspaceInputDialogProps {
  allowEmpty?: boolean;
  cancelLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
  submitLabel: string;
  title: string;
  value: string;
}

export function WorkspaceInputDialog({
  allowEmpty = false,
  cancelLabel,
  onCancel,
  onSubmit,
  onValueChange,
  submitLabel,
  title,
  value
}: WorkspaceInputDialogProps): ReactElement {
  const titleId = useId();
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (allowEmpty || value.trim()) onSubmit();
  };

  return createPortal(
    <div
      className="workspace-input-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <dialog
        aria-labelledby={titleId}
        aria-modal="true"
        className="workspace-input-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        open
      >
        <form onSubmit={submit}>
          <div className="workspace-input-dialog-title" id={titleId}>{title}</div>
          <input
            aria-label={title}
            autoFocus
            className="workspace-input-dialog-input"
            onChange={(event) => onValueChange(event.target.value)}
            type="text"
            value={value}
          />
          <div className="workspace-input-dialog-actions">
            <button onClick={onCancel} type="button">{cancelLabel}</button>
            <button disabled={!allowEmpty && !value.trim()} type="submit">{submitLabel}</button>
          </div>
        </form>
      </dialog>
    </div>,
    document.body
  );
}
