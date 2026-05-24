import type {
  FrontmatterTemplate,
  GanttChartSettings,
  GanttChartSource,
  RenameWorkspaceInput,
  SwitchWorkspaceInput,
  UpdateGanttChartEntryInput,
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
const reservedUserDefinedFieldNames = new Set(["aliases", "tags", "status", "chronicle", "plannedDate", "actualDate"]);
const ganttChartSources: GanttChartSource[] = ["chronicle", "date"];

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

export function isGanttChartsInput(input: unknown): input is GanttChartSettings[] {
  if (!Array.isArray(input) || input.length !== 2) return false;

  const sources = new Set<GanttChartSource>();

  return input.every((chart) => {
    if (typeof chart !== "object" || chart === null) return false;

    const candidate = chart as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.trim() === "") return false;
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") return false;
    if (!ganttChartSources.includes(candidate.source as GanttChartSource)) return false;
    if (sources.has(candidate.source as GanttChartSource)) return false;
    if ("filePaths" in candidate && !Array.isArray(candidate.filePaths)) return false;
    if (Array.isArray(candidate.filePaths) && !candidate.filePaths.every((path) => typeof path === "string")) return false;

    sources.add(candidate.source as GanttChartSource);
    return true;
  });
}

export function isUpdateGanttChartEntryInput(input: unknown): input is UpdateGanttChartEntryInput {
  if (typeof input !== "object" || input === null) return false;

  const candidate = input as Record<string, unknown>;
  const startValue = candidate.startValue;
  const endValue = candidate.endValue;

  if (typeof startValue !== "number" || typeof endValue !== "number") return false;

  return (
    typeof candidate.path === "string" &&
    ganttChartSources.includes(candidate.source as GanttChartSource) &&
    (!("dateKind" in candidate) || candidate.dateKind === "planned" || candidate.dateKind === "actual") &&
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

export function isWorkspaceIdInput(input: unknown): input is { workspaceId: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    typeof (input as { workspaceId?: unknown }).workspaceId === "string"
  );
}

export function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return isWorkspaceIdInput(input);
}

export function isRenameWorkspaceInput(input: unknown): input is RenameWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    "name" in input &&
    typeof (input as { workspaceId?: unknown }).workspaceId === "string" &&
    typeof (input as { name?: unknown }).name === "string"
  );
}
