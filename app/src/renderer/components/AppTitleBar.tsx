import type { ReactElement, ReactNode } from "react";

import type { AppTheme } from "../../shared/ipc";
import { useT } from "../i18n";

export interface AppTitleBarProps {
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  children?: ReactNode;
  isDarkTheme: boolean;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onThemeChange: (theme: Exclude<AppTheme, "system">) => void;
  showThemeSwitch: boolean;
}

export function AppTitleBar({
  canNavigateBack,
  canNavigateForward,
  children,
  isDarkTheme,
  onNavigateBack,
  onNavigateForward,
  onThemeChange,
  showThemeSwitch
}: AppTitleBarProps): ReactElement {
  const t = useT();
  const accessibleLabel = isDarkTheme ? t("settings.switchToLight") : t("settings.switchToDark");

  return (
    <div className="title-bar">
      {showThemeSwitch ? (
        <label className="switch sw-7 title-bar-theme-switch">
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
      <div
        aria-label={t("nav.history")}
        className={`title-bar-navigation${showThemeSwitch ? " title-bar-navigation--after-theme" : ""}`}
        role="group"
      >
        <button
          aria-label={t("nav.back")}
          className="title-bar-navigation-button"
          disabled={!canNavigateBack}
          onClick={onNavigateBack}
          type="button"
        >
          <NavigationChevron direction="back" />
        </button>
        <button
          aria-label={t("nav.forward")}
          className="title-bar-navigation-button"
          disabled={!canNavigateForward}
          onClick={onNavigateForward}
          type="button"
        >
          <NavigationChevron direction="forward" />
        </button>
      </div>
      <div className="title-bar-drag-area" />
      {children}
    </div>
  );
}

function NavigationChevron({ direction }: { direction: "back" | "forward" }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d={direction === "back" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
