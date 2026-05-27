import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import { MermaidVisualEditor } from "./MermaidVisualEditor";

interface MermaidEditorPopoverProps {
  blockRange: {
    from: number;
    to: number;
  };
  conflictMessage?: string | null;
  filePath: string;
  onChange: (source: string) => boolean | void;
  onClose: () => void;
  source: string;
}

export function MermaidEditorPopover({
  blockRange,
  conflictMessage,
  filePath,
  onChange,
  onClose,
  source
}: MermaidEditorPopoverProps): ReactElement {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-modal="true"
      className="mermaid-editor-popover-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section
        aria-label={t("mermaidEditor.title")}
        className="mermaid-editor-popover"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") onClose();
        }}
        onPointerCancel={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        ref={panelRef}
      >
        <header className="mermaid-editor-popover-header">
          <div>
            <p className="settings-page-kicker">{t("nav.mermaidEditor")}</p>
            <h2>{t("mermaidEditor.title")}</h2>
          </div>
          <button
            aria-label={t("mermaidEditor.close")}
            className="secondary-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            {t("mermaidEditor.close")}
          </button>
        </header>
        <MermaidVisualEditor
          blockRange={blockRange}
          externalError={conflictMessage}
          filePath={filePath}
          onChange={onChange}
          source={source}
        />
      </section>
    </div>
  );
}
