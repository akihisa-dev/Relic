import type { ReactElement, ReactNode } from "react";

import type { AppTheme } from "../../shared/ipc";
import { useT } from "../i18n";

export interface AppTitleBarProps {
  children?: ReactNode;
  isDarkTheme: boolean;
  onThemeChange: (theme: Exclude<AppTheme, "system">) => void;
  showThemeSwitch: boolean;
}

export function AppTitleBar({
  children,
  isDarkTheme,
  onThemeChange,
  showThemeSwitch
}: AppTitleBarProps): ReactElement {
  const t = useT();
  const accessibleLabel = isDarkTheme ? t("settings.switchToLight") : t("settings.switchToDark");

  return (
    <div className="title-bar">
      {showThemeSwitch ? (
        <label className="switch sw-7 title-bar-theme-switch" title={accessibleLabel}>
          <input
            aria-label={accessibleLabel}
            checked={isDarkTheme}
            onChange={(event) => onThemeChange(event.currentTarget.checked ? "dark" : "light")}
            type="checkbox"
          />
          <span aria-hidden="true" className="track">
            <span className="thumb" />
          </span>
        </label>
      ) : null}
      <div className="title-bar-drag-area" />
      {children}
    </div>
  );
}
