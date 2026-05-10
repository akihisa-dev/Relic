import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import type { FrontmatterTemplate, UserDefinedField, UserDefinedFieldType } from "../../shared/ipc";
import { useT } from "../i18n";

const FIELD_TYPES: UserDefinedFieldType[] = ["text", "number", "date", "boolean", "select", "multi-select", "tags", "url"];
const FIELD_NAME_PATTERN = /^[^\s:][^\r\n:]*$/;

function parseChoices(value: string): string[] | undefined {
  const choices = value.split(",").map((c) => c.trim()).filter(Boolean);

  return choices.length > 0 ? choices : undefined;
}

function choicesText(field: UserDefinedField): string {
  return field.choices?.join(", ") ?? "";
}

function needsChoices(type: UserDefinedFieldType): boolean {
  return type === "select" || type === "multi-select" || type === "tags";
}

export function FrontmatterSidebar({
  frontmatterTemplates,
  userDefinedFields,
  onFrontmatterTemplatesSave,
  onUserDefinedFieldsSave
}: {
  frontmatterTemplates: FrontmatterTemplate[];
  userDefinedFields: UserDefinedField[];
  onFrontmatterTemplatesSave: (templates: FrontmatterTemplate[]) => void;
  onUserDefinedFieldsSave: (fields: UserDefinedField[]) => void;
}): ReactElement {
  const [fieldsDraft, setFieldsDraft] = useState<UserDefinedField[]>(userDefinedFields);
  const [templatesDraft, setTemplatesDraft] = useState<FrontmatterTemplate[]>(frontmatterTemplates);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<UserDefinedFieldType>("text");
  const [newFieldChoices, setNewFieldChoices] = useState("");
  const [newTemplateFields, setNewTemplateFields] = useState<string[]>([]);
  const [newTemplateName, setNewTemplateName] = useState("");
  const t = useT();

  useEffect(() => {
    setFieldsDraft(userDefinedFields);
  }, [userDefinedFields]);

  useEffect(() => {
    setTemplatesDraft(frontmatterTemplates);
  }, [frontmatterTemplates]);

  const saveTemplates = (templates: FrontmatterTemplate[]): void => {
    setTemplatesDraft(templates);
    onFrontmatterTemplatesSave(templates);
  };

  const updateUserDefinedField = (index: number, nextField: UserDefinedField): void => {
    const previousField = fieldsDraft[index];
    const next = fieldsDraft.map((field, i) => (i === index ? nextField : field));
    setFieldsDraft(next);
    onUserDefinedFieldsSave(next);

    if (previousField && previousField.name !== nextField.name) {
      const nextTemplates = templatesDraft.map((template) => ({
        ...template,
        fieldNames: template.fieldNames.map((name) => name === previousField.name ? nextField.name : name)
      }));
      saveTemplates(nextTemplates);
      setNewTemplateFields((current) => current.map((name) => name === previousField.name ? nextField.name : name));
    }
  };

  const updateTemplate = (index: number, nextTemplate: FrontmatterTemplate): void => {
    saveTemplates(templatesDraft.map((template, i) => i === index ? nextTemplate : template));
  };

  const removeFieldFromTemplates = (fieldName: string): void => {
    const nextTemplates = templatesDraft
      .map((template) => ({
        ...template,
        fieldNames: template.fieldNames.filter((name) => name !== fieldName)
      }))
      .filter((template) => template.fieldNames.length > 0);

    saveTemplates(nextTemplates);
    setNewTemplateFields((current) => current.filter((name) => name !== fieldName));
  };

  const isFieldNameAvailable = (name: string, currentIndex?: number): boolean => (
    FIELD_NAME_PATTERN.test(name) &&
    !fieldsDraft.some((field, i) => field.name === name && i !== currentIndex)
  );

  return (
    <div className="sidebar-section settings-section frontmatter-settings-section">
      <div className="links-panel-subheading">{t("settings.customFields")}</div>
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
              removeFieldFromTemplates(field.name);
            }}
            title={t("common.delete")}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
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
        {needsChoices(newFieldType) ? (
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
      <div className="links-panel-subheading" style={{ marginTop: "1rem" }}>{t("settings.frontmatterTemplates")}</div>
      {templatesDraft.map((template, i) => (
        <div className="setting-template-editor" key={`${template.name}-${i}`}>
          <input
            className="setting-custom-field-input"
            onChange={(e) => {
              const name = e.target.value.trim();
              if (!name || templatesDraft.some((item, index) => item.name === name && index !== i)) return;
              updateTemplate(i, { ...template, name });
            }}
            placeholder={t("settings.frontmatterTemplateName")}
            type="text"
            value={template.name}
          />
          <div className="setting-template-field-list">
            {fieldsDraft.map((field) => (
              <label className="setting-template-field-choice" key={field.name}>
                <input
                  checked={template.fieldNames.includes(field.name)}
                  onChange={(e) => {
                    const fieldNames = e.target.checked
                      ? [...template.fieldNames, field.name]
                      : template.fieldNames.filter((name) => name !== field.name);
                    if (fieldNames.length === 0) return;
                    updateTemplate(i, { ...template, fieldNames });
                  }}
                  type="checkbox"
                />
                <span>{field.name}</span>
              </label>
            ))}
          </div>
          <button
            className="setting-action-btn setting-action-btn--danger"
            onClick={() => saveTemplates(templatesDraft.filter((_, index) => index !== i))}
            title={t("common.delete")}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <div className="setting-custom-field-form setting-custom-field-form--stacked">
        <input
          className="setting-custom-field-input"
          onChange={(e) => setNewTemplateName(e.target.value)}
          placeholder={t("settings.frontmatterTemplateName")}
          type="text"
          value={newTemplateName}
        />
        <div className="setting-template-field-list">
          {fieldsDraft.map((field) => (
            <label className="setting-template-field-choice" key={field.name}>
              <input
                checked={newTemplateFields.includes(field.name)}
                onChange={(e) => {
                  setNewTemplateFields((current) => (
                    e.target.checked
                      ? [...current, field.name]
                      : current.filter((name) => name !== field.name)
                  ));
                }}
                type="checkbox"
              />
              <span>{field.name}</span>
            </label>
          ))}
        </div>
        <button
          className="setting-action-btn"
          disabled={
            !newTemplateName.trim() ||
            newTemplateFields.length === 0 ||
            templatesDraft.some((template) => template.name === newTemplateName.trim())
          }
          onClick={() => {
            const name = newTemplateName.trim();
            if (!name || newTemplateFields.length === 0) return;
            saveTemplates([...templatesDraft, { fieldNames: newTemplateFields, name }]);
            setNewTemplateName("");
            setNewTemplateFields([]);
          }}
          type="button"
        >
          {t("settings.frontmatterTemplateAdd")}
        </button>
      </div>
    </div>
  );
}
