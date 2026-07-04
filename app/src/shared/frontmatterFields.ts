import type { UserDefinedFieldType } from "./ipc";

export const userDefinedFieldTypes: UserDefinedFieldType[] = [
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

const userDefinedFieldTypesSet = new Set<UserDefinedFieldType>(userDefinedFieldTypes);

export const userDefinedFieldNamePattern = /^[^\s:][^\r\n:]*$/;

export type FixedFrontmatterFieldName =
  | "aliases"
  | "category"
  | "tags"
  | "chronicle";

export const reservedFrontmatterFieldNames: FixedFrontmatterFieldName[] = [
  "aliases",
  "category",
  "tags",
  "chronicle"
];

const reservedFrontmatterFieldNameSet = new Set<string>(reservedFrontmatterFieldNames);
const userDefinedFieldTypesWithChoices = new Set<UserDefinedFieldType>(["select", "multi-select"]);

export function isReservedFrontmatterFieldName(name: string): boolean {
  return reservedFrontmatterFieldNameSet.has(name);
}

export function isUserDefinedFieldType(type: unknown): type is UserDefinedFieldType {
  return userDefinedFieldTypesSet.has(type as UserDefinedFieldType);
}

export function userDefinedFieldTypeNeedsChoices(type: UserDefinedFieldType): boolean {
  return userDefinedFieldTypesWithChoices.has(type);
}

export function isValidUserDefinedFieldName(name: string): boolean {
  return userDefinedFieldNamePattern.test(name) && !isReservedFrontmatterFieldName(name);
}
