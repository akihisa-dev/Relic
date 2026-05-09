import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import type { AppInfo, AutoSyncSettings, EditorSettings, FeatureToggles, GitHubIntegrationSettings, UserDefinedField, UserDefinedFieldType } from "../../shared/ipc";
import { useT } from "../i18n";

const FIELD_TYPES: UserDefinedFieldType[] = ["text", "number", "date", "boolean", "select", "multi-select", "url"];
const MAX_USER_DEFINED_FIELDS = 13;
const FIELD_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

function parseChoices(value: string): string[] | undefined {
  const choices = value.split(",").map((c) => c.trim()).filter(Boolean);

  return choices.length > 0 ? choices : undefined;
}

function choicesText(field: UserDefinedField): string {
  return field.choices?.join(", ") ?? "";
}

function needsChoices(type: UserDefinedFieldType): boolean {
  return type === "select" || type === "multi-select";
}

export function SettingsSidebar({
  appInfo,
  settings,
  autoSyncSettings,
  featureToggles,
  gitHubIntegrationSettings,
  userDefinedFields,
  onCreateFrontmatterTemplate,
  onSave,
  onAutoSyncSave,
  onFeatureTogglesSave,
  onGitHubIntegrationSave,
  onUserDefinedFieldsSave
}: {
  appInfo: AppInfo | null;
  settings: EditorSettings;
  autoSyncSettings: AutoSyncSettings;
  featureToggles: FeatureToggles;
  gitHubIntegrationSettings: GitHubIntegrationSettings;
  userDefinedFields: UserDefinedField[];
  onCreateFrontmatterTemplate: () => void;
  onSave: (s: EditorSettings) => void;
  onAutoSyncSave: (s: AutoSyncSettings) => void;
  onFeatureTogglesSave: (t: FeatureToggles) => void;
  onGitHubIntegrationSave: (s: GitHubIntegrationSettings) => void;
  onUserDefinedFieldsSave: (fields: UserDefinedField[]) => void;
}): ReactElement {
  const [draft, setDraft] = useState<EditorSettings>(settings);
  const [autoSyncDraft, setAutoSyncDraft] = useState<AutoSyncSettings>(autoSyncSettings);
  const [togglesDraft, setTogglesDraft] = useState<FeatureToggles>(featureToggles);
  const [gitHubDraft, setGitHubDraft] = useState<GitHubIntegrationSettings>(gitHubIntegrationSettings);
  const [fieldsDraft, setFieldsDraft] = useState<UserDefinedField[]>(userDefinedFields);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<UserDefinedFieldType>("text");
  const [newFieldChoices, setNewFieldChoices] = useState("");
  const t = useT();

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setAutoSyncDraft(autoSyncSettings);
  }, [autoSyncSettings]);

  useEffect(() => {
    setTogglesDraft(featureToggles);
  }, [featureToggles]);

  useEffect(() => {
    setGitHubDraft(gitHubIntegrationSettings);
  }, [gitHubIntegrationSettings]);

  useEffect(() => {
    setFieldsDraft(userDefinedFields);
  }, [userDefinedFields]);

  const update = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]): void => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSave(next);
  };

  const updateAutoSync = <K extends keyof AutoSyncSettings>(key: K, value: AutoSyncSettings[K]): void => {
    const next = { ...autoSyncDraft, [key]: value };
    setAutoSyncDraft(next);
    onAutoSyncSave(next);
  };

  const updateUserDefinedField = (index: number, nextField: UserDefinedField): void => {
    const next = fieldsDraft.map((field, i) => (i === index ? nextField : field));
    setFieldsDraft(next);
    onUserDefinedFieldsSave(next);
  };

  const updateGitHubIntegration = <K extends keyof GitHubIntegrationSettings>(
    key: K,
    value: GitHubIntegrationSettings[K]
  ): void => {
    const next = { ...gitHubDraft, [key]: value };
    setGitHubDraft(next);
    onGitHubIntegrationSave(next);
  };

  const isFieldNameAvailable = (name: string, currentIndex?: number): boolean => (
    FIELD_NAME_PATTERN.test(name) &&
    !fieldsDraft.some((field, i) => field.name === name && i !== currentIndex)
  );

  return (
    <div className="sidebar-section settings-section">
      <label className="setting-row">
        <span>{t("settings.font")}</span>
        <select
          aria-label={t("settings.font")}
          onChange={(e) => update("font", e.target.value as EditorSettings["font"])}
          value={draft.font}
        >
          <option value="system">{t("settings.fontSystem")}</option>
          <option value="mincho">{t("settings.fontMincho")}</option>
          <option value="mono">Menlo</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{t("settings.fontSize")}</span>
        <input
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
          max={3}
          min={1}
          onChange={(e) => update("lineHeight", Number(e.target.value))}
          step={0.1}
          type="number"
          value={draft.lineHeight}
        />
      </label>
      <label className="setting-row">
        <span>{t("settings.maxWidth")}</span>
        <select
          aria-label={t("settings.maxWidth")}
          onChange={(e) => update("maxWidth", e.target.value as EditorSettings["maxWidth"])}
          value={draft.maxWidth}
        >
          <option value="550px">{t("settings.maxWidthNarrow")}</option>
          <option value="660px">{t("settings.maxWidthStandard")}</option>
          <option value="800px">{t("settings.maxWidthWide")}</option>
          <option value="none">{t("settings.maxWidthNone")}</option>
        </select>
      </label>
      <label className="setting-row">
        <span>{t("settings.language")}</span>
        <select
          aria-label={t("settings.language")}
          onChange={(e) => update("language", e.target.value as EditorSettings["language"])}
          value={draft.language}
        >
          <option value="system">{t("settings.languageSystem")}</option>
          <option value="en">{t("settings.languageEnglish")}</option>
          <option value="ja">{t("settings.languageJapanese")}</option>
        </select>
      </label>
      <label className="setting-row">
        <input
          checked={draft.showLineNumbers}
          onChange={(e) => update("showLineNumbers", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.showLineNumbers")}</span>
      </label>
      <label className="setting-row">
        <input
          checked={draft.spellCheck}
          onChange={(e) => update("spellCheck", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.spellCheck")}</span>
      </label>
      <label className="setting-row">
        <span>{t("settings.theme")}</span>
        <select
          aria-label={t("settings.theme")}
          onChange={(e) => update("theme", e.target.value as EditorSettings["theme"])}
          value={draft.theme}
        >
          <option value="system">{t("settings.themeSystem")}</option>
          <option value="light">{t("settings.light")}</option>
          <option value="dark">{t("settings.dark")}</option>
        </select>
      </label>
      <div className="setting-row setting-row--action">
        <span>{t("settings.frontmatterTemplate")}</span>
        <button className="setting-action-btn" onClick={onCreateFrontmatterTemplate} type="button">
          {t("settings.createFrontmatterTemplate")}
        </button>
      </div>
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.githubIntegration")}</div>
      <label className="setting-row">
        <span>{t("settings.githubClientId")}</span>
        <input
          aria-label={t("settings.githubClientId")}
          onChange={(e) => updateGitHubIntegration("clientId", e.target.value)}
          placeholder="Iv1..."
          type="text"
          value={gitHubDraft.clientId}
        />
      </label>
      <label className="setting-row">
        <span>{t("settings.githubScopes")}</span>
        <input
          aria-label={t("settings.githubScopes")}
          onBlur={(e) => updateGitHubIntegration(
            "scopes",
            e.target.value.split(",").map((scope) => scope.trim()).filter(Boolean)
          )}
          placeholder={t("settings.githubScopesPlaceholder")}
          type="text"
          defaultValue={gitHubDraft.scopes.join(", ")}
          key={gitHubDraft.scopes.join(",")}
        />
      </label>
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.autoSync")}</div>
      <label className="setting-row">
        <input
          checked={autoSyncDraft.autoPull}
          onChange={(e) => updateAutoSync("autoPull", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.autoPull")}</span>
      </label>
      <label className="setting-row">
        <input
          checked={autoSyncDraft.autoPush}
          onChange={(e) => updateAutoSync("autoPush", e.target.checked)}
          type="checkbox"
        />
        <span>{t("settings.autoPush")}</span>
      </label>
      <label className="setting-row">
        <span>{t("settings.interval")}</span>
        <select
          aria-label={t("settings.interval")}
          disabled={!autoSyncDraft.autoPull && !autoSyncDraft.autoPush}
          onChange={(e) => updateAutoSync("intervalMinutes", Number(e.target.value) as AutoSyncSettings["intervalMinutes"])}
          value={autoSyncDraft.intervalMinutes}
        >
          <option value={5}>5 min</option>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>60 min</option>
        </select>
      </label>
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.featureToggles")}</div>
      {(
        [
          { key: "git", label: t("settings.featureGit") },
          { key: "tools", label: t("settings.featureTools") },
          { key: "frontmatter", label: t("settings.featureFrontmatter") },
          { key: "rightPanel", label: t("settings.featureRightPanel") }
        ] as { key: keyof FeatureToggles; label: string }[]
      ).map(({ key, label }) => (
        <label className="setting-row" key={key}>
          <input
            checked={togglesDraft[key]}
            onChange={(e) => {
              const next = { ...togglesDraft, [key]: e.target.checked };
              setTogglesDraft(next);
              onFeatureTogglesSave(next);
            }}
            type="checkbox"
          />
          <span>{label}</span>
        </label>
      ))}
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.customFields")}</div>
      {fieldsDraft.map((field, i) => (
        <div className="setting-custom-field-edit" key={`${field.name}-${i}`}>
          <input
            className="setting-custom-field-input"
            onChange={(e) => {
              const name = e.target.value.trim();
              if (!isFieldNameAvailable(name, i)) return;
              updateUserDefinedField(i, { ...field, name });
            }}
            placeholder={t("settings.customFieldName")}
            type="text"
            value={field.name}
          />
          <select
            aria-label={t("settings.customFieldType")}
            onChange={(e) => {
              const type = e.target.value as UserDefinedFieldType;
              updateUserDefinedField(i, {
                name: field.name,
                type,
                ...(needsChoices(type) && field.choices ? { choices: field.choices } : {})
              });
            }}
            value={field.type}
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </select>
          {needsChoices(field.type) ? (
            <input
              className="setting-custom-field-input"
              defaultValue={choicesText(field)}
              onBlur={(e) => {
                const choices = parseChoices(e.target.value);
                updateUserDefinedField(i, { ...field, ...(choices ? { choices } : { choices: undefined }) });
              }}
              placeholder={t("settings.customFieldChoices")}
              type="text"
            />
          ) : null}
          <button
            className="setting-action-btn setting-action-btn--danger"
            onClick={() => {
              const next = fieldsDraft.filter((_, j) => j !== i);
              setFieldsDraft(next);
              onUserDefinedFieldsSave(next);
            }}
            title={t("common.delete")}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      {fieldsDraft.length < MAX_USER_DEFINED_FIELDS ? (
        <div className="setting-custom-field-form">
          <input
            className="setting-custom-field-input"
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder={t("settings.customFieldName")}
            type="text"
            value={newFieldName}
          />
          <select
            aria-label={t("settings.customFieldType")}
            onChange={(e) => setNewFieldType(e.target.value as UserDefinedFieldType)}
            value={newFieldType}
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </select>
          {(newFieldType === "select" || newFieldType === "multi-select") ? (
            <input
              className="setting-custom-field-input"
              onChange={(e) => setNewFieldChoices(e.target.value)}
              placeholder={t("settings.customFieldChoices")}
              type="text"
              value={newFieldChoices}
            />
          ) : null}
          <button
            className="setting-action-btn"
            disabled={!isFieldNameAvailable(newFieldName.trim())}
            onClick={() => {
              const name = newFieldName.trim();
              if (!isFieldNameAvailable(name)) return;
              const field: UserDefinedField = { name, type: newFieldType };
              const choices = parseChoices(newFieldChoices);
              if (needsChoices(newFieldType) && choices) {
                field.choices = choices;
              }
              const next = [...fieldsDraft, field];
              setFieldsDraft(next);
              onUserDefinedFieldsSave(next);
              setNewFieldName("");
              setNewFieldChoices("");
            }}
            type="button"
          >
            {t("settings.customFieldAdd")}
          </button>
        </div>
      ) : (
        <div className="settings-info">{t("settings.customFieldLimit", { max: MAX_USER_DEFINED_FIELDS })}</div>
      )}
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.appInfo")}</div>
      <div className="settings-info">
        <div>Relic {appInfo?.version ?? "0.0.0"}</div>
        <div>{appInfo?.platform ?? "darwin"}</div>
      </div>
    </div>
  );
}
