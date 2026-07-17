import type {
  FeatureToggles,
  FrontmatterCategoryChoice,
  FrontmatterTemplate,
  ChartSettings,
  ChartSource,
  RenameWorkspaceInput,
  RefreshWorkspaceInput,
  SwitchWorkspaceInput,
  UpdateChartEntryInput,
  UserDefinedField,
} from "../../shared/ipc";
import {
  isUserDefinedFieldType,
  isValidUserDefinedFieldName,
  userDefinedFieldNamePattern,
  userDefinedFieldTypeNeedsChoices
} from "../../shared/frontmatterFields";
import { isWorkspaceRelativeInputPath } from "../files/paths";

const chartSources: ChartSource[] = ["chronicle"];
const workspaceIdPattern = /^[A-Za-z0-9_-]+$/;

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
        if (typeof choice !== "string" || choice.trim() !== choice || choice === "" || choices.has(choice)) return false;
        choices.add(choice);
      }
    }

    return true;
  });
}

export function isChartsInput(input: unknown): input is ChartSettings[] {
  if (!Array.isArray(input) || input.length !== 1) return false;

  const sources = new Set<ChartSource>();

  return input.every((chart) => {
    if (typeof chart !== "object" || chart === null) return false;

    const candidate = chart as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") return false;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (!chartSources.includes(candidate.source as ChartSource)) return false;
    if (sources.has(candidate.source as ChartSource)) return false;
    if ("filePaths" in candidate && !Array.isArray(candidate.filePaths)) return false;
    if (Array.isArray(candidate.filePaths) && !candidate.filePaths.every(isWorkspaceRelativeInputPath)) return false;

    sources.add(candidate.source as ChartSource);
    return true;
  });
}

export function isUpdateChartEntryInput(input: unknown): input is UpdateChartEntryInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as Record<string, unknown>;
  const startValue = candidate.startValue;
  const endValue = candidate.endValue;

  if (typeof startValue !== "number" || typeof endValue !== "number") return false;

  return (
    isWorkspaceRelativeInputPath(candidate.path) &&
    chartSources.includes(candidate.source as ChartSource) &&
    Number.isInteger(candidate.chronicleEntryIndex) &&
    Number(candidate.chronicleEntryIndex) >= 0 &&
    (candidate.kind === "move" || candidate.kind === "resize-start" || candidate.kind === "resize-end") &&
    Number.isInteger(candidate.originalStartValue) &&
    Number.isInteger(candidate.originalEndValue) &&
    Number.isInteger(startValue) &&
    Number.isInteger(endValue) &&
    startValue <= endValue
  );
}

export function isFrontmatterCategoryChoicesInput(input: unknown): input is FrontmatterCategoryChoice[] {
  if (!Array.isArray(input)) return false;

  const choices = new Set<string>();

  return input.every((choice) => {
    if (typeof choice !== "string") return false;
    if (choice.trim() !== choice || choice === "" || choices.has(choice)) return false;
    choices.add(choice);
    return true;
  });
}

export function isTablePropertiesInput(input: unknown): input is string[] {
  if (!Array.isArray(input) || input.length > 1000) return false;

  const properties = new Set<string>();
  return input.every((property) => {
    if (
      typeof property !== "string" ||
      property.length === 0 ||
      property.length > 1024 ||
      property.trim() !== property ||
      property.includes("\0") ||
      properties.has(property)
    ) return false;

    properties.add(property);
    return true;
  });
}

export function isFrontmatterTemplatesInput(input: unknown): input is FrontmatterTemplate[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((template) => {
    if (typeof template !== "object" || template === null) return false;
    const candidate = template as Record<string, unknown>;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);

    return (
      Array.isArray(candidate.fieldNames) &&
      candidate.fieldNames.length > 0 &&
      candidate.fieldNames.every((fieldName) => (
        typeof fieldName === "string" && userDefinedFieldNamePattern.test(fieldName)
      ))
    );
  });
}

export function isFeatureTogglesInput(input: unknown): input is FeatureToggles {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;

  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.cards === "boolean" &&
    typeof candidate.chronicle === "boolean" &&
    typeof candidate.graph === "boolean" &&
    typeof candidate.sphere === "boolean" &&
    typeof candidate.table === "boolean" &&
    typeof candidate.tools === "boolean" &&
    typeof candidate.frontmatter === "boolean"
  );
}

export function isWorkspaceIdInput(input: unknown): input is { workspaceId: string } {
  const workspaceId = (input as { workspaceId?: unknown })?.workspaceId;

  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    typeof workspaceId === "string" &&
    workspaceId.trim() === workspaceId &&
    workspaceIdPattern.test(workspaceId)
  );
}

export function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRefreshWorkspaceInput(input: unknown): input is RefreshWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRenameWorkspaceInput(input: unknown): input is RenameWorkspaceInput {
  return (
    isWorkspaceIdInput(input) &&
    "workspaceId" in input &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}
