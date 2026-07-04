import {
  type FixedFrontmatterFieldName,
  isValidUserDefinedFieldName,
  userDefinedFieldTypes,
  userDefinedFieldTypeNeedsChoices
} from "../shared/frontmatterFields";
import type { UserDefinedField, UserDefinedFieldType } from "../shared/ipc";
import type { TranslationKey, Translator } from "./i18nModel";

export const FIELD_TYPES = userDefinedFieldTypes;

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

export type FixedFieldDefinition = {
  name: FixedFrontmatterFieldName;
  descriptionKey: TranslationKey;
  examples: TranslationKey[];
};

export const CHRONICLE_FIXED_FIELDS: FixedFieldDefinition[] = [{
  name: "chronicle",
  descriptionKey: "settings.fixedFieldChronicleDescription",
  examples: ["settings.fixedFieldChronicleSingleExample", "settings.fixedFieldChronicleRangeExample"]
}];

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
    name: "category",
    descriptionKey: "settings.fixedFieldCategoryDescription",
    examples: ["settings.fixedFieldCategoryExample"]
  }
];

export function needsChoices(type: UserDefinedFieldType): boolean {
  return userDefinedFieldTypeNeedsChoices(type);
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
    isValidUserDefinedFieldName(name) &&
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
