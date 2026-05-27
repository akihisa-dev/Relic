import type { ReactElement } from "react";

import { useT } from "../i18n";

export function MermaidEditorPanel(): ReactElement {
  const t = useT();

  return (
    <div className="settings-page mermaid-editor-page">
      <header className="settings-page-header mermaid-editor-page-header">
        <p className="settings-page-kicker">{t("nav.mermaidEditor")}</p>
        <h2>{t("mermaidEditor.panelTitle")}</h2>
      </header>
      <div className="mermaid-visual-state-banner" role="status">
        {t("mermaidEditor.openFromMarkdown")}
      </div>
    </div>
  );
}
