import { useMemo } from "react";
import type { ReactElement } from "react";

import { resolveLanguage } from "../../shared/i18n";
import type { AppLanguage } from "../../shared/ipc";
import { useT } from "../i18n";
import type { EditorSaveStatus } from "../hooks/useEditorAutoSave";
import { textCount } from "../paneViewModel";
import type { FileTab } from "../store/editorStore";

interface AppStatusBarProps {
  activeFileTab: FileTab | null;
  language: AppLanguage;
  onLanguageChange: (language: Exclude<AppLanguage, "system">) => void;
  saveStatus?: EditorSaveStatus;
}

export function AppStatusBar({
  activeFileTab,
  language,
  onLanguageChange,
  saveStatus
}: AppStatusBarProps): ReactElement {
  const t = useT();
  const resolvedLanguage = resolveLanguage(
    language,
    typeof navigator === "undefined" ? undefined : navigator.language
  );
  const isEnglish = resolvedLanguage === "en";
  const languageSwitchLabel = isEnglish
    ? t("app.languageSwitch.toJapanese")
    : t("app.languageSwitch.toEnglish");
  const count = useMemo(
    () => textCount(activeFileTab?.content ?? ""),
    [activeFileTab?.content]
  );
  const saveStatusLabel = saveStatus ? {
    dirty: t("app.saveStatus.dirty"),
    error: t("app.saveStatus.error"),
    externalConflict: t("app.saveStatus.externalConflict"),
    saved: t("app.saveStatus.saved"),
    saving: t("app.saveStatus.saving")
  }[saveStatus] : null;

  return (
    <footer className="status-bar">
      <span>Relic</span>
      {activeFileTab && saveStatusLabel ? <span>{saveStatusLabel}</span> : null}
      <span>{t("app.wordCount", { chars: count.chars, words: count.words })}</span>
      <label className="switch status-bar-language-switch">
        <input
          aria-label={languageSwitchLabel}
          checked={isEnglish}
          onChange={(event) => onLanguageChange(event.currentTarget.checked ? "en" : "ja")}
          type="checkbox"
        />
        <span aria-hidden="true" className="track">
          <span className="thumb">{isEnglish ? "EN" : "JP"}</span>
        </span>
      </label>
    </footer>
  );
}
