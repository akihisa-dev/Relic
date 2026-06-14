import { type ReactElement, useState } from "react";

import { useT } from "../../i18n";

type CopyStatus = "copied" | "failed" | "idle";

interface DiagramToolbarProps {
  mermaidSource: string;
}

export function DiagramToolbar({ mermaidSource }: DiagramToolbarProps): ReactElement {
  const t = useT();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const copyMermaid = (): void => {
    const writeText = navigator.clipboard?.writeText;
    if (!writeText) {
      setCopyStatus("failed");
      return;
    }

    void writeText.call(navigator.clipboard, mermaidSource)
      .then(() => setCopyStatus("copied"))
      .catch(() => setCopyStatus("failed"));
  };
  const label = copyStatus === "copied"
    ? t("editor.copyDone")
    : copyStatus === "failed"
      ? t("editor.copyFailed")
      : t("diagram.copyMermaid");

  return (
    <div className="diagram-toolbar">
      <button
        aria-label={t("diagram.copyMermaidAria")}
        className="diagram-toolbar-button"
        onClick={copyMermaid}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}
