import type { ReactElement } from "react";

import type { UserDefinedFieldType } from "../../shared/ipc";
import {
  FIELD_TYPES,
  FIELD_TYPE_DESCRIPTION_KEYS,
  FIELD_TYPE_LABEL_KEYS,
  formatYamlExample,
  needsChoices
} from "../frontmatterSettingsModel";
import { useT } from "../i18n";
import { FrontmatterChoiceEditor } from "./FrontmatterChoiceEditor";

interface FrontmatterFieldAddFormProps {
  canAddNewField: boolean;
  newChoiceInput: string;
  newChoices: string[];
  newFieldName: string;
  newFieldType: UserDefinedFieldType;
  onAddNewChoices: () => void;
  onAddNewField: () => void;
  onNewChoiceInputChange: (value: string) => void;
  onNewChoicesChange: (choices: string[]) => void;
  onNewFieldNameChange: (value: string) => void;
  onNewFieldTypeChange: (type: UserDefinedFieldType) => void;
}

export function FrontmatterFieldAddForm({
  canAddNewField,
  newChoiceInput,
  newChoices,
  newFieldName,
  newFieldType,
  onAddNewChoices,
  onAddNewField,
  onNewChoiceInputChange,
  onNewChoicesChange,
  onNewFieldNameChange,
  onNewFieldTypeChange
}: FrontmatterFieldAddFormProps): ReactElement {
  const t = useT();

  return (
    <div className="frontmatter-field-add">
      <input
        className="setting-custom-field-input"
        onChange={(e) => onNewFieldNameChange(e.target.value)}
        placeholder={t("settings.customFieldName")}
        type="text"
        value={newFieldName}
      />
      <select
        aria-label={t("settings.customFieldType")}
        className="frontmatter-field-type-select"
        onChange={(e) => onNewFieldTypeChange(e.target.value as UserDefinedFieldType)}
        value={newFieldType}
      >
        {FIELD_TYPES.map((type) => (
          <option key={type} value={type}>{t(FIELD_TYPE_LABEL_KEYS[type])}</option>
        ))}
      </select>
      <p className="frontmatter-field-type-help">{t(FIELD_TYPE_DESCRIPTION_KEYS[newFieldType])}</p>
      <div className="frontmatter-writing-example">
        <span>{t("settings.customFieldWritingExample")}</span>
        <code>{formatYamlExample(newFieldName, newFieldType, newChoices, t)}</code>
      </div>
      {needsChoices(newFieldType) ? (
        <FrontmatterChoiceEditor
          choices={newChoices}
          input={newChoiceInput}
          onAddChoices={onAddNewChoices}
          onInputChange={onNewChoiceInputChange}
          onRemoveChoice={(choice) => onNewChoicesChange(newChoices.filter((item) => item !== choice))}
        />
      ) : null}
      <button
        className="setting-action-btn frontmatter-field-add-btn"
        disabled={!canAddNewField}
        onClick={onAddNewField}
        type="button"
      >
        {t("settings.customFieldAdd")}
      </button>
    </div>
  );
}
