import type { ReactElement } from "react";

import {
  type AppInfo,
  type EditorSettings,
  type FeatureToggles
} from "../../shared/ipc";
import { useT } from "../i18n";
import { SettingsSegmentedControl } from "./SettingsSegmentedControl";
import { SettingsToggleSwitch } from "./SettingsToggleSwitch";

const publicRepositoryUrl = "https://github.com/akihisa-dev/Relic";

function RepositoryIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="settings-repository-icon"
      fill="currentColor"
      viewBox="0 0 256 256"
    >
      <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />
    </svg>
  );
}

export function SettingsPanel({
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
  const t = useT();
  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void => {
    const next = { ...settings, [key]: value };
    onSave(next);
  };

  return (
    <div className="settings-page settings-section">
      <header className="settings-page-header">
        <h2>{t("nav.settings")}</h2>
      </header>

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
                { label: t("settings.fontSansMac"), value: "gothic" },
                { label: t("settings.fontSerifMac"), value: "mincho" },
                { label: t("settings.fontMonoMac"), value: "mono" }
              ]}
              value={settings.font}
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
              value={settings.fontSize}
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
              value={settings.lineHeight}
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
              value={settings.maxWidth}
            />
          </div>
          <div className="setting-row">
            <span>{t("settings.showLineNumbers")}</span>
            <SettingsToggleSwitch
              label={t("settings.showLineNumbers")}
              on={settings.showLineNumbers}
              onChange={(on) => update("showLineNumbers", on)}
            />
          </div>
          <div className="setting-row">
            <span>{t("settings.spellCheck")}</span>
            <SettingsToggleSwitch
              label={t("settings.spellCheck")}
              on={settings.spellCheck}
              onChange={(on) => update("spellCheck", on)}
            />
          </div>
          <div className="setting-row">
            <span>{t("settings.frontmatterDateFormat")}</span>
            <SettingsSegmentedControl
              ariaLabel={t("settings.frontmatterDateFormat")}
              onChange={(value) => update("frontmatterDateFormat", value)}
              options={[
                { label: t("settings.frontmatterDateFormatYmd"), value: "ymd" },
                { label: t("settings.frontmatterDateFormatMdy"), value: "mdy" },
                { label: t("settings.frontmatterDateFormatDmy"), value: "dmy" },
                { label: t("settings.frontmatterDateFormatSystem"), value: "system" }
              ]}
              value={settings.frontmatterDateFormat}
            />
          </div>
        </div>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("settings.sectionFeatures")}</div>
        <div className="settings-stack">
          {(
            [
              { key: "cards", label: t("settings.featureCards") },
              { key: "table", label: t("settings.featureTable") },
              { key: "graph", label: t("settings.featureBubble") },
              { key: "sphere", label: t("settings.featureSphere") },
              { key: "chronicle", label: t("settings.featureChronicle") }
            ] as { key: keyof FeatureToggles; label: string }[]
          ).map(({ key, label }) => (
            <div className="setting-row" key={key}>
              <span>{label}</span>
              <SettingsToggleSwitch
                label={label}
                on={featureToggles[key]}
                onChange={(on) => {
                  const next = { ...featureToggles, [key]: on };
                  onFeatureTogglesSave(next);
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <div className="links-panel-subheading">{t("settings.sectionAppInfo")}</div>
        <div className="settings-info">
          <div>Relic {appInfo?.version ?? "0.0.0"}</div>
          <div>macOS</div>
          <div>
            <a href={publicRepositoryUrl} rel="noreferrer" target="_blank">
              <RepositoryIcon />
              {t("settings.repository", { url: publicRepositoryUrl })}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
