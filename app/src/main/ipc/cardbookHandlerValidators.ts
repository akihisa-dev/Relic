import type {
  FrontmatterTemplate,
  TimelineChartSettings,
  TimelineChartSource,
  RenameCardbookInput,
  SwitchCardbookInput,
  UpdateTimelineChartEntryInput,
  UserDefinedField,
  UserDefinedFieldType
} from "../../shared/ipc";

const userDefinedFieldTypes: UserDefinedFieldType[] = [
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
const userDefinedFieldNamePattern = /^[^\s:][^\r\n:]*$/;
const reservedUserDefinedFieldNames = new Set(["aliases", "tags", "status", "timeline"]);
const timelineChartSources: TimelineChartSource[] = ["timeline"];

export function isUserDefinedFieldsInput(input: unknown): input is UserDefinedField[] {
  if (!Array.isArray(input)) return false;

  const names = new Set<string>();

  return input.every((field) => {
    if (typeof field !== "object" || field === null) return false;
    const candidate = field as Record<string, unknown>;

    if (
      typeof candidate.name !== "string" ||
      !userDefinedFieldNamePattern.test(candidate.name) ||
      reservedUserDefinedFieldNames.has(candidate.name)
    ) return false;
    if (names.has(candidate.name)) return false;
    names.add(candidate.name);
    if (!userDefinedFieldTypes.includes(candidate.type as UserDefinedFieldType)) return false;
    if ("choices" in candidate && !Array.isArray(candidate.choices)) return false;
    if (Array.isArray(candidate.choices) && !candidate.choices.every((choice) => typeof choice === "string")) return false;

    return true;
  });
}

export function isTimelineChartsInput(input: unknown): input is TimelineChartSettings[] {
  if (!Array.isArray(input) || input.length !== 1) return false;

  const sources = new Set<TimelineChartSource>();

  return input.every((chart) => {
    if (typeof chart !== "object" || chart === null) return false;

    const candidate = chart as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") return false;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (!timelineChartSources.includes(candidate.source as TimelineChartSource)) return false;
    if (sources.has(candidate.source as TimelineChartSource)) return false;
    if ("cardPaths" in candidate && !Array.isArray(candidate.cardPaths)) return false;
    if (Array.isArray(candidate.cardPaths) && !candidate.cardPaths.every((path) => typeof path === "string")) return false;

    sources.add(candidate.source as TimelineChartSource);
    return true;
  });
}

export function isUpdateTimelineChartEntryInput(input: unknown): input is UpdateTimelineChartEntryInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as Record<string, unknown>;
  const startValue = candidate.startValue;
  const endValue = candidate.endValue;

  if (typeof startValue !== "number" || typeof endValue !== "number") return false;

  return (
    typeof candidate.path === "string" &&
    timelineChartSources.includes(candidate.source as TimelineChartSource) &&
    (candidate.kind === "move" || candidate.kind === "resize-start" || candidate.kind === "resize-end") &&
    Number.isInteger(candidate.originalStartValue) &&
    Number.isInteger(candidate.originalEndValue) &&
    Number.isInteger(startValue) &&
    Number.isInteger(endValue) &&
    startValue <= endValue
  );
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

export function isCardbookIdInput(input: unknown): input is { cardbookId: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "cardbookId" in input &&
    typeof (input as { cardbookId?: unknown }).cardbookId === "string"
  );
}

export function isSwitchCardbookInput(input: unknown): input is SwitchCardbookInput {
  return isCardbookIdInput(input);
}

export function isRenameCardbookInput(input: unknown): input is RenameCardbookInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "cardbookId" in input &&
    "name" in input &&
    typeof (input as { cardbookId?: unknown }).cardbookId === "string" &&
    typeof (input as { name?: unknown }).name === "string"
  );
}
