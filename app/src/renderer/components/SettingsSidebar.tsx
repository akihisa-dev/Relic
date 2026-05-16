import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { type AppInfo, type EditorSettings, type FeatureToggles } from "../../shared/ipc";
import { useT } from "../i18n";
import { SettingsSegmentedControl } from "./SettingsSegmentedControl";

export function SettingsSidebar({
  appInfo,
  settings,
  featureToggles,
  onSave,
  onFeatureTogglesSave
}: {
  appInfo: AppInfo | null;
  settings: EditorSettings;
  featureToggles: FeatureToggles;
  onSave: (s: EditorSettings) => void;
  onFeatureTogglesSave: (t: FeatureToggles) => void;
}): ReactElement {
  const [draft, setDraft] = useState<EditorSettings>(settings);
  const [togglesDraft, setTogglesDraft] = useState<FeatureToggles>(featureToggles);
  const t = useT();

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setTogglesDraft(featureToggles);
  }, [featureToggles]);

  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSave(next);
  };

  return (
    <div className="settings-page settings-section">
      <header className="settings-page-header">
        <h2>{t("nav.settings")}</h2>
      </header>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("settings.sectionAppearance")}</div>
        <div className="settings-stack">
          <div className="setting-row">
            <span>{t("settings.theme")}</span>
            <SettingsSegmentedControl
              ariaLabel={t("settings.theme")}
              onChange={(value) => update("theme", value)}
              options={[
                { label: t("settings.themeSystem"), value: "system" },
                { label: t("settings.light"), value: "light" },
                { label: t("settings.dark"), value: "dark" }
              ]}
              value={draft.theme}
            />
          </div>
          <div className="setting-row">
            <span>{t("settings.language")}</span>
            <SettingsSegmentedControl
              ariaLabel={t("settings.language")}
              onChange={(value) => update("language", value)}
              options={[
                { label: t("settings.languageSystem"), value: "system" },
                { label: t("settings.languageEnglish"), value: "en" },
                { label: t("settings.languageJapanese"), value: "ja" }
              ]}
              value={draft.language}
            />
          </div>
        </div>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("settings.sectionEditor")}</div>
        <div className="settings-stack">
          <div className="setting-row">
            <span>{t("settings.font")}</span>
            <SettingsSegmentedControl
              ariaLabel={t("settings.font")}
              onChange={(value) => update("font", value)}
              options={[
                { label: t("settings.fontSystem"), value: "system" },
                { label: t("settings.fontMincho"), value: "mincho" },
                { label: "Menlo", value: "mono" }
              ]}
              value={draft.font}
            />
          </div>
          <label className="setting-row">
            <span>{t("settings.fontSize")}</span>
            <input
              className="settings-control settings-number-input"
              max={32}
              min={10}
              onChange={(e) => update("fontSize", Number(e.target.value))}
              type="number"
              value={draft.fontSize}
            />
          </label>
          <label className="setting-row">
            <span>{t("settings.lineHeight")}</span>
            <input
              className="settings-control settings-number-input"
              max={3}
              min={1}
              onChange={(e) => update("lineHeight", Number(e.target.value))}
              step={0.1}
              type="number"
              value={draft.lineHeight}
            />
          </label>
          <div className="setting-row">
            <span>{t("settings.maxWidth")}</span>
            <SettingsSegmentedControl
              ariaLabel={t("settings.maxWidth")}
              onChange={(value) => update("maxWidth", value)}
              options={[
                { label: t("settings.maxWidthNarrow"), value: "550px" },
                { label: t("settings.maxWidthStandard"), value: "660px" },
                { label: t("settings.maxWidthWide"), value: "800px" },
                { label: t("settings.maxWidthNone"), value: "none" }
              ]}
              value={draft.maxWidth}
            />
          </div>
          <label className="setting-row">
            <span>{t("settings.showLineNumbers")}</span>
            <input
              checked={draft.showLineNumbers}
              onChange={(e) => update("showLineNumbers", e.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="setting-row">
            <span>{t("settings.spellCheck")}</span>
            <input
              checked={draft.spellCheck}
              onChange={(e) => update("spellCheck", e.target.checked)}
              type="checkbox"
            />
          </label>
        </div>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("settings.sectionFeatures")}</div>
        <div className="settings-stack">
          {(
            [
              { key: "tools", label: t("settings.featureTools") },
              { key: "frontmatter", label: t("settings.featureFrontmatter") },
              { key: "rightPanel", label: t("settings.featureRightPanel") }
            ] as { key: keyof FeatureToggles; label: string }[]
          ).map(({ key, label }) => (
            <label className="setting-row" key={key}>
              <span>{label}</span>
              <input
                checked={togglesDraft[key]}
                onChange={(e) => {
                  const next = { ...togglesDraft, [key]: e.target.checked };
                  setTogglesDraft(next);
                  onFeatureTogglesSave(next);
                }}
                type="checkbox"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("settings.sectionAppInfo")}</div>
        <div className="settings-info">
          <div>Relic {appInfo?.version ?? "0.0.0"}</div>
          <div>{appInfo?.platform ?? "-"}</div>
        </div>
      </section>
    </div>
  );
}
