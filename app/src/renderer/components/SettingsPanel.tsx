import type { ReactElement } from "react";

import {
  type AppInfo,
  type EditorSettings,
  type FeatureToggles
} from "../../shared/ipc";
import { useT } from "../i18n";
import type { TranslationKey } from "../i18nModel";
import { SettingsSegmentedControl } from "./SettingsSegmentedControl";
import { SettingsToggleSwitch } from "./SettingsToggleSwitch";

const publicRepositoryUrl = "https://github.com/akihisa-dev/Relic";

function getEditorFontLabelKeys(platform?: NodeJS.Platform): { gothic: TranslationKey; mincho: TranslationKey; mono: TranslationKey } {
  if (platform === "win32") {
    return {
      gothic: "settings.fontGothicWindows",
      mincho: "settings.fontMinchoWindows",
      mono: "settings.fontMonoWindows"
    };
  }

  return {
    gothic: "settings.fontGothicMac",
    mincho: "settings.fontMinchoMac",
    mono: "settings.fontMonoMac"
  };
}

function formatPlatformLabel(platform?: NodeJS.Platform): string {
  if (!platform) return "-";

  const labels: Partial<Record<NodeJS.Platform, string>> = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows"
  };

  return labels[platform] ?? platform;
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
  const fontLabelKeys = getEditorFontLabelKeys(appInfo?.platform);

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
        <div className="links-panel-subheading">{t("settings.sectionAppearance")}</div>
        <div className="settings-stack">
          <div className="setting-row">
            <span>{t("settings.theme")}</span>
            <SettingsSegmentedControl
              ariaLabel={t("settings.theme")}
              onChange={(value) => update("theme", value)}
              options={[
                { label: t("settings.themeSystem"), value: "system" },
                { icon: <LightModeIcon />, label: t("settings.light"), value: "light" },
                { icon: <DarkModeIcon />, label: t("settings.dark"), value: "dark" }
              ]}
              value={settings.theme}
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
              value={settings.language}
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
                { label: t(fontLabelKeys.gothic), value: "gothic" },
                { label: t(fontLabelKeys.mincho), value: "mincho" },
                { label: t(fontLabelKeys.mono), value: "mono" }
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
              { key: "tools", label: t("settings.featureTools") },
              { key: "frontmatter", label: t("settings.featureFrontmatter") },
              { key: "cards", label: t("settings.featureCards") },
              { key: "graph", label: t("settings.featureGraph") },
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
          <div>{formatPlatformLabel(appInfo?.platform)}</div>
          <div>
            <a href={publicRepositoryUrl} rel="noreferrer" target="_blank">
              {t("settings.repository", { url: publicRepositoryUrl })}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function LightModeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function DarkModeIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="14">
      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </svg>
  );
}
