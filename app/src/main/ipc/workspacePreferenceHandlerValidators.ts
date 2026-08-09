import { isValidChronicleCalendarRange } from "../../shared/chronicleCalendar";
import {
  isUserDefinedFieldType,
  isValidUserDefinedFieldName,
  userDefinedFieldNamePattern,
  userDefinedFieldTypeNeedsChoices
} from "../../shared/frontmatterFields";
import type {
  ChronicleCalendarSettings,
  FrontmatterCategoryChoice,
  FrontmatterTemplate,
  SaveWorkspaceChronicleCalendarSettingsInput,
  SaveWorkspaceFrontmatterCategoryChoicesInput,
  UserDefinedField
} from "../../shared/ipc";
import { isWorkspaceIdInput } from "./inputValidation";

export function isUserDefinedFieldsInput(input: unknown): input is UserDefinedField[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((field) => {
    if (typeof field !== "object" || field === null) return false;
    const candidate = field as Record<string, unknown>;

    if (
      typeof candidate.name !== "string" ||
      !isValidUserDefinedFieldName(candidate.name)
    ) return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);
    if (!isUserDefinedFieldType(candidate.type)) return false;
    const type = candidate.type;
    if ("choices" in candidate && !Array.isArray(candidate.choices)) return false;
    if (Array.isArray(candidate.choices)) {
      if (!userDefinedFieldTypeNeedsChoices(type)) return false;
      const choices = new Set<string>();
      for (const choice of candidate.choices) {
        if (
          typeof choice !== "string" ||
          choice.trim() !== choice ||
          choice === "" ||
          choices.has(choice)
        ) {
          return false;
        }
        choices.add(choice);
      }
    }

    return true;
  });
}

export function isFrontmatterCategoryChoicesInput(
  input: unknown
): input is FrontmatterCategoryChoice[] {
  if (!Array.isArray(input)) return false;

  const choices = new Set<string>();

  return input.every((choice) => {
    if (typeof choice !== "string") return false;
    if (choice.trim() !== choice || choice === "" || choices.has(choice)) {
      return false;
    }
    choices.add(choice);
    return true;
  });
}

export function isSaveWorkspaceFrontmatterCategoryChoicesInput(
  input: unknown
): input is SaveWorkspaceFrontmatterCategoryChoicesInput {
  if (!isMutationRecord(input) || !isWorkspaceIdInput(input)) return false;
  return isFrontmatterCategoryChoicesInput((input as Record<string, unknown>).choices);
}

export function isChronicleCalendarSettingsInput(
  input: unknown
): input is ChronicleCalendarSettings {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const candidate = input as Record<string, unknown>;
  if (
    typeof candidate.baseCalendarName !== "string" ||
    !validCalendarName(candidate.baseCalendarName)
  ) {
    return false;
  }
  if (!Array.isArray(candidate.calendars) || candidate.calendars.length > 32) {
    return false;
  }
  const names = new Set([candidate.baseCalendarName]);
  for (const value of candidate.calendars) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const calendar = value as Record<string, unknown>;
    if (
      typeof calendar.name !== "string" ||
      !validCalendarName(calendar.name) ||
      names.has(calendar.name)
    ) {
      return false;
    }
    if (!Number.isSafeInteger(calendar.yearOne) || calendar.yearOne === 0) {
      return false;
    }
    if (calendar.range !== null) {
      if (
        typeof calendar.range !== "object" ||
        Array.isArray(calendar.range)
      ) {
        return false;
      }
      const range = calendar.range as Record<string, unknown>;
      if (
        !isValidChronicleCalendarRange({
          end: Number(range.end),
          start: Number(range.start)
        })
      ) {
        return false;
      }
    }
    names.add(calendar.name);
  }
  return Array.isArray(candidate.visibleCalendarNames) &&
    candidate.visibleCalendarNames.length > 0 &&
    new Set(candidate.visibleCalendarNames).size ===
      candidate.visibleCalendarNames.length &&
    candidate.visibleCalendarNames[0] === candidate.baseCalendarName &&
    candidate.visibleCalendarNames.every(
      (name) => typeof name === "string" && names.has(name)
    );
}

export function isSaveWorkspaceChronicleCalendarSettingsInput(
  input: unknown
): input is SaveWorkspaceChronicleCalendarSettingsInput {
  if (!isMutationRecord(input) || !isWorkspaceIdInput(input)) return false;
  return isChronicleCalendarSettingsInput((input as Record<string, unknown>).settings);
}

export function isFrontmatterTemplatesInput(
  input: unknown
): input is FrontmatterTemplate[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((template) => {
    if (typeof template !== "object" || template === null) return false;
    const candidate = template as Record<string, unknown>;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
      return false;
    }
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);

    return (
      Array.isArray(candidate.fieldNames) &&
      candidate.fieldNames.length > 0 &&
      candidate.fieldNames.every((fieldName) => (
        typeof fieldName === "string" &&
        userDefinedFieldNamePattern.test(fieldName)
      ))
    );
  });
}

function validCalendarName(name: string): boolean {
  return name.length > 0 &&
    name.length <= 100 &&
    name.trim() === name &&
    !name.includes("\0");
}

function isMutationRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
