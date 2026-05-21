import type { ReactElement } from "react";

import { useT } from "../i18n";

export function CalendarSettingsSidebar(): ReactElement {
  const t = useT();

  return (
    <div className="settings-page settings-section">
      <header className="settings-page-header">
        <h2>{t("nav.calendarSettings")}</h2>
      </header>
    </div>
  );
}
