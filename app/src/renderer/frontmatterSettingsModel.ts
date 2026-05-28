import { chronicleCalendarIds, type ChronicleCalendarId, type UserDefinedField, type UserDefinedFieldType } from "../shared/ipc";
import type { TranslationKey, Translator } from "./i18nModel";

export const FIELD_TYPES: UserDefinedFieldType[] = [
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

export const FIELD_TYPE_LABEL_KEYS: Record<UserDefinedFieldType, TranslationKey> = {
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

export const FIELD_TYPE_DESCRIPTION_KEYS: Record<UserDefinedFieldType, TranslationKey> = {
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

const RESERVED_FIELD_NAMES = new Set(["aliases", "tags", "status", ...chronicleCalendarIds, "plannedDate", "actualDate"]);

export type FixedFieldDefinition = {
  name: "actualDate" | "aliases" | "tags" | "status" | ChronicleCalendarId | "plannedDate";
  descriptionKey: TranslationKey;
  examples: TranslationKey[];
};

export const CHRONICLE_FIXED_FIELDS: FixedFieldDefinition[] = chronicleCalendarIds.map((name) => ({
  name,
  descriptionKey: "settings.fixedFieldChronicleDescription",
  examples: ["settings.fixedFieldChronicleSingleExample", "settings.fixedFieldChronicleRangeExample"]
}));

export const STANDARD_FIXED_FIELDS: FixedFieldDefinition[] = [
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

const FIXED_FIELDS: FixedFieldDefinition[] = [
  ...STANDARD_FIXED_FIELDS.slice(0, 3),
  ...CHRONICLE_FIXED_FIELDS,
  ...STANDARD_FIXED_FIELDS.slice(3)
];

export function needsChoices(type: UserDefinedFieldType): boolean {
  return type === "select" || type === "multi-select";
}

export function parseChoiceInput(value: string): string[] {
  return value.split(/[,\n]/).flatMap((choice) => {
    const item = choice.trim();
    return item ? [item] : [];
  });
}

export function uniqueChoices(choices: string[]): string[] {
  return Array.from(new Set(choices));
}

export function isFieldNameAvailable(fields: UserDefinedField[], name: string, currentIndex?: number): boolean {
  return (
    FIELD_NAME_PATTERN.test(name) &&
    !RESERVED_FIELD_NAMES.has(name) &&
    !fields.some((field, i) => field.name === name && i !== currentIndex)
  );
}

export function formatYamlExample(name: string, type: UserDefinedFieldType, choices: string[], t: Translator): string {
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

export function nextExpandedFieldAfterDelete(fields: UserDefinedField[], deletedIndex: number): string | null {
  return fields[deletedIndex]?.name ?? fields[deletedIndex - 1]?.name ?? null;
}
