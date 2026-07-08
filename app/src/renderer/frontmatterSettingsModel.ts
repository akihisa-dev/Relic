import type { FixedFrontmatterFieldName } from "../shared/frontmatterFields";
import type { TranslationKey } from "./i18nModel";

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

export const FIXED_FIELDS: FixedFieldDefinition[] = [...STANDARD_FIXED_FIELDS, ...CHRONICLE_FIXED_FIELDS];

export function parseChoiceInput(value: string): string[] {
  return value.split(/[,\n]/).flatMap((choice) => {
    const item = choice.trim();
    return item ? [item] : [];
  });
}

export function uniqueChoices(choices: string[]): string[] {
  return Array.from(new Set(choices));
}
