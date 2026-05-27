import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import { MermaidCanvasEditor } from "./MermaidCanvasEditor";

interface CanvasPopoverProps {
  blockRange: {
    from: number;
    to: number;
  };
  filePath: string;
  onChange: (source: string) => void;
  onClose: () => void;
  source: string;
}

export function CanvasPopover({
  blockRange,
  filePath,
  onChange,
  onClose,
  source
}: CanvasPopoverProps): ReactElement {
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
      className="canvas-popover-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section
        aria-label={t("canvas.popoverTitle")}
        className="canvas-popover"
        onPointerDown={(event) => event.stopPropagation()}
        ref={panelRef}
      >
        <header className="canvas-popover-header">
          <div>
            <p className="settings-page-kicker">{t("nav.canvas")}</p>
            <h2>{t("canvas.popoverTitle")}</h2>
          </div>
          <button
            aria-label={t("canvas.close")}
            className="secondary-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            {t("canvas.close")}
          </button>
        </header>
        <MermaidCanvasEditor
          blockRange={blockRange}
          filePath={filePath}
          onChange={onChange}
          source={source}
        />
      </section>
    </div>
  );
}
