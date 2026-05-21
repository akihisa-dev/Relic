import type { ReactElement } from "react";

import { useT } from "../i18n";

export function TimelineSettingsSidebar(): ReactElement {
  const t = useT();

  return (
    <div className="settings-page settings-section">
      <header className="settings-page-header">
        <h2>{t("nav.timelineSettings")}</h2>
      </header>
    </div>
  );
}
