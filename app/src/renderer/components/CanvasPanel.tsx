import type { ReactElement } from "react";

import { useT } from "../i18n";

export function CanvasPanel(): ReactElement {
  const t = useT();

  return (
    <div className="settings-page canvas-page">
      <header className="settings-page-header canvas-page-header">
        <p className="settings-page-kicker">{t("nav.canvas")}</p>
        <h2>{t("canvas.title")}</h2>
      </header>
      <div className="canvas-state-banner" role="status">
        {t("canvas.openFromMarkdown")}
      </div>
    </div>
  );
}
