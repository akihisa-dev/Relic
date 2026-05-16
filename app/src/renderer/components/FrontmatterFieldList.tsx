import type { ReactElement } from "react";

import type { UserDefinedField, UserDefinedFieldType } from "../../shared/ipc";
import {
  FIELD_TYPES,
  FIELD_TYPE_DESCRIPTION_KEYS,
  FIELD_TYPE_LABEL_KEYS,
  formatYamlExample,
  needsChoices
} from "../frontmatterSettingsModel";
import { useT } from "../i18n";
import { FrontmatterChoiceEditor } from "./FrontmatterChoiceEditor";

interface FrontmatterFieldListProps {
  addChoicesToField: (index: number, input: string) => void;
  choiceInputs: Record<string, string>;
  commitFieldName: (index: number) => void;
  deleteField: (index: number) => void;
  expandedField: string | null;
  fieldNameDrafts: string[];
  fieldsDraft: UserDefinedField[];
  onChoiceInputChange: (fieldName: string, value: string) => void;
  onExpandedFieldChange: (fieldName: string | null) => void;
  onFieldNameDraftChange: (index: number, name: string) => void;
  onFieldNameDraftReset: (index: number, name: string) => void;
  updateUserDefinedField: (index: number, nextField: UserDefinedField) => void;
}

export function FrontmatterFieldList({
  addChoicesToField,
  choiceInputs,
  commitFieldName,
  deleteField,
  expandedField,
  fieldNameDrafts,
  fieldsDraft,
  onChoiceInputChange,
  onExpandedFieldChange,
  onFieldNameDraftChange,
  onFieldNameDraftReset,
  updateUserDefinedField
}: FrontmatterFieldListProps): ReactElement {
  const t = useT();

  return (
    <div className="frontmatter-field-list">
      {fieldsDraft.length === 0 ? (
        <div className="frontmatter-field-empty">{t("settings.customFieldEmpty")}</div>
      ) : null}

      {fieldsDraft.map((field, i) => {
        const isExpanded = expandedField === field.name;

        return (
          <section className="frontmatter-field-card" data-expanded={isExpanded} key={`${field.name}-${i}`}>
            <button
              className="frontmatter-field-summary"
              onClick={() => onExpandedFieldChange(isExpanded ? null : field.name)}
              type="button"
            >
              <span className="frontmatter-field-name">{field.name}</span>
              <span className="frontmatter-field-type">{t(FIELD_TYPE_LABEL_KEYS[field.type])}</span>
            </button>
            <div className="frontmatter-field-summary-example">
              <span>{t("settings.customFieldWritingExample")}</span>
              <code>{formatYamlExample(field.name, field.type, field.choices ?? [], t)}</code>
            </div>

            {isExpanded ? (
              <div className="frontmatter-field-detail">
                <label className="frontmatter-field-label">
                  <span>{t("settings.customFieldName")}</span>
                  <input
                    className="setting-custom-field-input"
                    onChange={(e) => onFieldNameDraftChange(i, e.target.value)}
                    onBlur={() => commitFieldName(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitFieldName(i);
                        e.currentTarget.blur();
                        return;
                      }
                      if (e.key === "Escape") {
                        onFieldNameDraftReset(i, field.name);
                        e.currentTarget.blur();
                      }
                    }}
                    type="text"
                    value={fieldNameDrafts[i] ?? field.name}
                  />
                </label>
                <label className="frontmatter-field-label">
                  <span>{t("settings.customFieldType")}</span>
                  <span className="frontmatter-field-type-control">
                    <select
                      aria-label={t("settings.customFieldType")}
                      className="frontmatter-field-type-select"
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
                      {FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>{t(FIELD_TYPE_LABEL_KEYS[type])}</option>
                      ))}
                    </select>
                    <span className="frontmatter-field-type-help">{t(FIELD_TYPE_DESCRIPTION_KEYS[field.type])}</span>
                  </span>
                </label>

                {needsChoices(field.type) ? (
                  <div className="frontmatter-field-label">
                    <span>{t("settings.customFieldChoices")}</span>
                    <FrontmatterChoiceEditor
                      choices={field.choices ?? []}
                      input={choiceInputs[field.name] ?? ""}
                      onAddChoices={() => addChoicesToField(i, choiceInputs[field.name] ?? "")}
                      onInputChange={(value) => onChoiceInputChange(field.name, value)}
                      onRemoveChoice={(choice) => {
                        const choices = (field.choices ?? []).filter((item) => item !== choice);
                        updateUserDefinedField(i, { ...field, ...(choices.length > 0 ? { choices } : { choices: undefined }) });
                      }}
                    />
                  </div>
                ) : null}

                <button
                  className="setting-action-btn setting-action-btn--danger frontmatter-field-delete"
                  onClick={() => deleteField(i)}
                  type="button"
                >
                  {t("common.delete")}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
