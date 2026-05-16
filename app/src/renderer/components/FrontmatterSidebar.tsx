import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import type { UserDefinedField, UserDefinedFieldType } from "../../shared/ipc";
import { useT, type TranslationKey } from "../i18n";

const FIELD_TYPES: UserDefinedFieldType[] = [
  "text",
  "number",
  "date",
  "datetime",
  "time",
  "boolean",
  "select",
  "multi-select",
  "url"
];
const FIELD_NAME_PATTERN = /^[^\s:][^\r\n:]*$/;
const FIELD_TYPE_LABEL_KEYS: Record<UserDefinedFieldType, TranslationKey> = {
  boolean: "settings.fieldTypeBoolean",
  date: "settings.fieldTypeDate",
  datetime: "settings.fieldTypeDatetime",
  "multi-select": "settings.fieldTypeMultiSelect",
  number: "settings.fieldTypeNumber",
  select: "settings.fieldTypeSelect",
  time: "settings.fieldTypeTime",
  text: "settings.fieldTypeText",
  url: "settings.fieldTypeUrl"
};
const FIELD_TYPE_DESCRIPTION_KEYS: Record<UserDefinedFieldType, TranslationKey> = {
  boolean: "settings.fieldTypeBooleanDescription",
  date: "settings.fieldTypeDateDescription",
  datetime: "settings.fieldTypeDatetimeDescription",
  "multi-select": "settings.fieldTypeMultiSelectDescription",
  number: "settings.fieldTypeNumberDescription",
  select: "settings.fieldTypeSelectDescription",
  time: "settings.fieldTypeTimeDescription",
  text: "settings.fieldTypeTextDescription",
  url: "settings.fieldTypeUrlDescription"
};
const RESERVED_FIELD_NAMES = new Set(["aliases", "tags", "status", "chronicle", "date", "plannedDate", "actualDate"]);
const FIXED_FIELDS: Array<{
  name: "actualDate" | "aliases" | "tags" | "status" | "chronicle" | "plannedDate";
  descriptionKey: TranslationKey;
  examples: TranslationKey[];
}> = [
  {
    name: "aliases",
    descriptionKey: "settings.fixedFieldAliasesDescription",
    examples: ["settings.fixedFieldAliasesSingleExample", "settings.fixedFieldAliasesMultipleExample"]
  },
  {
    name: "tags",
    descriptionKey: "settings.fixedFieldTagsDescription",
    examples: ["settings.fixedFieldTagsSingleExample", "settings.fixedFieldTagsMultipleExample"]
  },
  {
    name: "status",
    descriptionKey: "settings.fixedFieldStatusDescription",
    examples: ["settings.fixedFieldStatusSingleExample"]
  },
  {
    name: "chronicle",
    descriptionKey: "settings.fixedFieldChronicleDescription",
    examples: ["settings.fixedFieldChronicleSingleExample", "settings.fixedFieldChronicleRangeExample"]
  },
  {
    name: "plannedDate",
    descriptionKey: "settings.fixedFieldPlannedDateDescription",
    examples: ["settings.fixedFieldPlannedDateSingleExample", "settings.fixedFieldPlannedDateRangeExample"]
  },
  {
    name: "actualDate",
    descriptionKey: "settings.fixedFieldActualDateDescription",
    examples: ["settings.fixedFieldActualDateSingleExample", "settings.fixedFieldActualDateRangeExample"]
  }
];

function needsChoices(type: UserDefinedFieldType): boolean {
  return type === "select" || type === "multi-select";
}

function parseChoiceInput(value: string): string[] {
  return value.split(/[,\n]/).map((choice) => choice.trim()).filter(Boolean);
}

function uniqueChoices(choices: string[]): string[] {
  return Array.from(new Set(choices));
}

function formatYamlExample(name: string, type: UserDefinedFieldType, choices: string[], t: (key: TranslationKey) => string): string {
  const fieldName = name.trim() || t("settings.customFieldExampleName");
  const [firstChoice, secondChoice] = choices.length > 0
    ? [choices[0], choices[1] ?? t("settings.customFieldExampleChoiceSecond")]
    : [t("settings.customFieldExampleChoiceFirst"), t("settings.customFieldExampleChoiceSecond")];

  switch (type) {
    case "boolean":
      return `${fieldName}: [true]`;
    case "date":
      return `${fieldName}: [2026-05-20]`;
    case "datetime":
      return `${fieldName}: [2026-05-20T09:30]`;
    case "multi-select":
      return `${fieldName}: [${firstChoice}, ${secondChoice}]`;
    case "number":
      return `${fieldName}: [3]`;
    case "select":
      return `${fieldName}: [${firstChoice}]`;
    case "time":
      return `${fieldName}: [09:30]`;
    case "url":
      return `${fieldName}: [https://example.com]`;
    case "text":
    default:
      return `${fieldName}: [${t("settings.customFieldExampleTextValue")}]`;
  }
}

export function FrontmatterSidebar({
  userDefinedFields,
  onUserDefinedFieldsSave
}: {
  userDefinedFields: UserDefinedField[];
  onUserDefinedFieldsSave: (fields: UserDefinedField[]) => void;
}): ReactElement {
  const [fieldsDraft, setFieldsDraft] = useState<UserDefinedField[]>(userDefinedFields);
  const [expandedField, setExpandedField] = useState<string | null>(userDefinedFields[0]?.name ?? null);
  const [fieldNameDrafts, setFieldNameDrafts] = useState<string[]>(() => userDefinedFields.map((field) => field.name));
  const [choiceInputs, setChoiceInputs] = useState<Record<string, string>>({});
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<UserDefinedFieldType>("text");
  const [newChoiceInput, setNewChoiceInput] = useState("");
  const [newChoices, setNewChoices] = useState<string[]>([]);
  const t = useT();

  useEffect(() => {
    setFieldsDraft(userDefinedFields);
    setFieldNameDrafts(userDefinedFields.map((field) => field.name));
    setExpandedField((current) => current && userDefinedFields.some((field) => field.name === current)
      ? current
      : userDefinedFields[0]?.name ?? null);
  }, [userDefinedFields]);

  const saveFields = (fields: UserDefinedField[]): void => {
    setFieldsDraft(fields);
    onUserDefinedFieldsSave(fields);
  };

  const isFieldNameAvailable = (name: string, currentIndex?: number): boolean => (
    FIELD_NAME_PATTERN.test(name) &&
    !RESERVED_FIELD_NAMES.has(name) &&
    !fieldsDraft.some((field, i) => field.name === name && i !== currentIndex)
  );

  const updateUserDefinedField = (index: number, nextField: UserDefinedField): void => {
    const previousName = fieldsDraft[index]?.name;
    saveFields(fieldsDraft.map((field, i) => (i === index ? nextField : field)));

    if (previousName && previousName !== nextField.name) {
      setExpandedField(nextField.name);
      setFieldNameDrafts((current) => current.map((name, i) => (i === index ? nextField.name : name)));
      setChoiceInputs((current) => {
        const next = { ...current, [nextField.name]: current[previousName] ?? "" };
        delete next[previousName];
        return next;
      });
    }
  };

  const addChoicesToField = (index: number, input: string): void => {
    const field = fieldsDraft[index];
    if (!field) return;

    const choices = parseChoiceInput(input);
    if (choices.length === 0) return;

    updateUserDefinedField(index, {
      ...field,
      choices: uniqueChoices([...(field.choices ?? []), ...choices])
    });
    setChoiceInputs((current) => ({ ...current, [field.name]: "" }));
  };

  const addNewChoices = (): void => {
    const choices = parseChoiceInput(newChoiceInput);
    if (choices.length === 0) return;

    setNewChoices((current) => uniqueChoices([...current, ...choices]));
    setNewChoiceInput("");
  };

  const commitFieldName = (index: number): void => {
    const field = fieldsDraft[index];
    if (!field) return;

    const name = (fieldNameDrafts[index] ?? field.name).trim();
    if (name === field.name) {
      setFieldNameDrafts((current) => current.map((item, i) => (i === index ? field.name : item)));
      return;
    }

    if (!isFieldNameAvailable(name, index)) {
      setFieldNameDrafts((current) => current.map((item, i) => (i === index ? field.name : item)));
      return;
    }

    updateUserDefinedField(index, { ...field, name });
  };

  const canAddNewField = isFieldNameAvailable(newFieldName.trim());

  return (
    <div className="sidebar-section settings-section frontmatter-settings-section">
      <div className="links-panel-subheading">{t("settings.frontmatterProperties")}</div>
      <div className="frontmatter-format-guide">
        <p>{t("settings.frontmatterFormatGuide")}</p>
        <code>{t("settings.frontmatterFormatExample")}</code>
      </div>

      <div className="frontmatter-field-group-label">{t("settings.fixedFields")}</div>
      {FIXED_FIELDS.map((field) => (
        <section className="frontmatter-field-card frontmatter-field-card--fixed" key={field.name}>
          <div className="frontmatter-field-summary frontmatter-field-summary--static">
            <span className="frontmatter-field-name">{field.name}</span>
            <span className="frontmatter-field-type">{t("settings.fixedField")}</span>
          </div>
          <div className="frontmatter-field-description">
            <p>{t(field.descriptionKey)}</p>
            <div className="frontmatter-field-examples" aria-label={t("settings.frontmatterExampleLabel")}>
              {field.examples.map((exampleKey) => (
                <code key={exampleKey}>{t(exampleKey)}</code>
              ))}
            </div>
          </div>
        </section>
      ))}

      <div className="frontmatter-field-group-label">{t("settings.freeFields")}</div>

      <div className="frontmatter-field-add">
        <input
          className="setting-custom-field-input"
          onChange={(e) => setNewFieldName(e.target.value)}
          placeholder={t("settings.customFieldName")}
          type="text"
          value={newFieldName}
        />
        <select
          aria-label={t("settings.customFieldType")}
          className="frontmatter-field-type-select"
          onChange={(e) => {
            const type = e.target.value as UserDefinedFieldType;
            setNewFieldType(type);
            if (!needsChoices(type)) {
              setNewChoices([]);
              setNewChoiceInput("");
            }
          }}
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
          <div className="frontmatter-choice-editor">
            <div className="frontmatter-choice-list">
              {newChoices.map((choice) => (
                <span className="frontmatter-choice-pill" key={choice}>
                  <span>{choice}</span>
                  <button
                    aria-label={t("settings.removeChoice", { choice })}
                    onClick={() => setNewChoices((current) => current.filter((item) => item !== choice))}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="frontmatter-choice-add">
              <input
                className="setting-custom-field-input"
                onChange={(e) => setNewChoiceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addNewChoices();
                }}
                placeholder={t("settings.choiceAddPlaceholder")}
                type="text"
                value={newChoiceInput}
              />
              <button className="setting-action-btn" disabled={!newChoiceInput.trim()} onClick={addNewChoices} type="button">
                {t("settings.choiceAdd")}
              </button>
            </div>
          </div>
        ) : null}
        <button
          className="setting-action-btn frontmatter-field-add-btn"
          disabled={!canAddNewField}
          onClick={() => {
            const name = newFieldName.trim();
            if (!isFieldNameAvailable(name)) return;

            const field: UserDefinedField = { name, type: newFieldType };
            if (needsChoices(newFieldType) && newChoices.length > 0) {
              field.choices = newChoices;
            }

            const next = [...fieldsDraft, field];
            saveFields(next);
            setExpandedField(name);
            setNewFieldName("");
            setNewFieldType("text");
            setNewChoiceInput("");
            setNewChoices([]);
          }}
          type="button"
        >
          {t("settings.customFieldAdd")}
        </button>
      </div>

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
                onClick={() => setExpandedField(isExpanded ? null : field.name)}
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
                      onChange={(e) => {
                        const name = e.target.value;
                        setFieldNameDrafts((current) => {
                          const next = [...current];
                          next[i] = name;
                          return next;
                        });
                      }}
                      onBlur={() => commitFieldName(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitFieldName(i);
                          e.currentTarget.blur();
                          return;
                        }
                        if (e.key === "Escape") {
                          setFieldNameDrafts((current) => current.map((name, index) => (index === i ? field.name : name)));
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
                      <div className="frontmatter-choice-editor">
                        <div className="frontmatter-choice-list">
                          {(field.choices ?? []).map((choice) => (
                            <span className="frontmatter-choice-pill" key={choice}>
                              <span>{choice}</span>
                              <button
                                aria-label={t("settings.removeChoice", { choice })}
                                onClick={() => {
                                  const choices = (field.choices ?? []).filter((item) => item !== choice);
                                  updateUserDefinedField(i, { ...field, ...(choices.length > 0 ? { choices } : { choices: undefined }) });
                                }}
                                type="button"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="frontmatter-choice-add">
                          <input
                            className="setting-custom-field-input"
                            onChange={(e) => setChoiceInputs((current) => ({ ...current, [field.name]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              addChoicesToField(i, choiceInputs[field.name] ?? "");
                            }}
                            placeholder={t("settings.choiceAddPlaceholder")}
                            type="text"
                            value={choiceInputs[field.name] ?? ""}
                          />
                          <button
                            className="setting-action-btn"
                            disabled={!(choiceInputs[field.name] ?? "").trim()}
                            onClick={() => addChoicesToField(i, choiceInputs[field.name] ?? "")}
                            type="button"
                          >
                            {t("settings.choiceAdd")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <button
                    className="setting-action-btn setting-action-btn--danger frontmatter-field-delete"
                    onClick={() => {
                      const next = fieldsDraft.filter((_, j) => j !== i);
                      saveFields(next);
                      setExpandedField(next[i]?.name ?? next[i - 1]?.name ?? null);
                    }}
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
    </div>
  );
}
