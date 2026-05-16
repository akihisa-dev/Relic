import type {
  GanttChartEntry,
  RelicApi,
  UpdateGanttChartEntryInput,
  WorkspaceGanttChart,
  WorkspaceTreeNode
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";
import { collectMarkdownPaths } from "../shared/workspaceTree";

type GanttChartFileReader = Pick<RelicApi, "readMarkdownFile">["readMarkdownFile"];
type GanttChartEntryFallbackApi = Pick<RelicApi, "getWorkspaceChronicle" | "readMarkdownFile" | "writeMarkdownFile">;

export function normalizeWorkspaceGanttCharts(value: unknown): WorkspaceGanttChart[] {
  if (!Array.isArray(value)) return [];

  if (value.every(isWorkspaceGanttChart)) return fixedWorkspaceGanttCharts(value);

  const legacyEntries = value.flatMap((entry): GanttChartEntry[] => {
    if (typeof entry !== "object" || entry === null) return [];

    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.path !== "string" ||
      typeof candidate.fileName !== "string" ||
      typeof candidate.startYear !== "number" ||
      typeof candidate.endYear !== "number"
    ) return [];

    return [{
      endLabel: formatLegacyChronicleYear(candidate.endYear),
      endValue: legacyChronicleYearToAxis(candidate.endYear),
      fileName: candidate.fileName,
      path: candidate.path,
      startLabel: formatLegacyChronicleYear(candidate.startYear),
      startValue: legacyChronicleYearToAxis(candidate.startYear)
    }];
  });

  return legacyEntries.length > 0
    ? fixedWorkspaceGanttCharts([{ entries: legacyEntries, filePaths: legacyEntries.map((entry) => entry.path), id: "chronicle", name: "chronicle", source: "chronicle" }])
    : fixedWorkspaceGanttCharts([]);
}

export async function normalizeWorkspaceGanttChartsWithFiles(
  value: unknown,
  fileTree: WorkspaceTreeNode[],
  readMarkdownFile: GanttChartFileReader
): Promise<WorkspaceGanttChart[]> {
  const charts = normalizeWorkspaceGanttCharts(value);
  const dateEntries = await readDateChartEntriesFromFiles(fileTree, readMarkdownFile);

  if (dateEntries.length === 0) return charts;

  return charts.map((chart) => (
    chart.source === "date"
      ? { ...chart, entries: dateEntries }
      : chart
  ));
}

export async function readDateChartEntriesFromFiles(
  fileTree: WorkspaceTreeNode[],
  readMarkdownFile: GanttChartFileReader
): Promise<GanttChartEntry[]> {
  const paths = collectMarkdownPaths(fileTree);
  const entries = await Promise.all(paths.map(async (filePath): Promise<GanttChartEntry[]> => {
    const file = await readMarkdownFile({ path: filePath });

    if (!file?.ok) return [];

    const frontmatter = splitFrontmatterBlock(file.value.content);
    if (!frontmatter) return [];

    const plannedRange = readChartDateRange(frontmatter.yaml, "plannedDate") ?? readChartDateRange(frontmatter.yaml, "date");
    const actualRange = readChartDateRange(frontmatter.yaml, "actualDate");
    const statuses = readYamlArrayField(frontmatter.yaml, "status");
    const fileName = file.value.name || filePath.split("/").at(-1)?.replace(/\.md$/, "") || filePath;
    const result: GanttChartEntry[] = [];

    if (plannedRange) {
      result.push(dateRangeToEntry(filePath, fileName, "planned", plannedRange, statuses));
    }

    if (actualRange) {
      result.push(dateRangeToEntry(filePath, fileName, "actual", actualRange, statuses));
    }

    return result;
  }));

  return entries
    .flat()
    .sort((a, b) =>
      a.fileName.localeCompare(b.fileName, "ja") ||
        a.path.localeCompare(b.path, "ja") ||
        dateKindOrderForRenderer(a.dateKind) - dateKindOrderForRenderer(b.dateKind) ||
        a.startValue - b.startValue ||
        a.endValue - b.endValue
    );
}

export async function updateGanttChartEntryFallback(
  input: UpdateGanttChartEntryInput,
  relic: GanttChartEntryFallbackApi
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  const file = await relic.readMarkdownFile({ path: input.path });

  if (!file.ok) return { error: file.error, ok: false };

  const content = updateChartFrontmatter(file.value.content, input);
  const write = await relic.writeMarkdownFile({ content, path: input.path });

  if (!write.ok) return { error: write.error, ok: false };

  const charts = await relic.getWorkspaceChronicle();

  if (!charts.ok) return { error: charts.error, ok: false };

  return { ok: true, value: charts.value };
}

export function updateChartFrontmatter(content: string, input: UpdateGanttChartEntryInput): string {
  const frontmatter = splitFrontmatterBlock(content);
  const yamlText = frontmatter?.yaml ?? "";
  const updates = chartFrontmatterUpdates(yamlText, input);
  const nextYaml = Object.entries(updates).reduce(
    (yaml, [field, values]) => setYamlArrayField(yaml, field, values),
    yamlText
  );

  if (frontmatter) {
    return `${frontmatter.open}${nextYaml}${frontmatter.close}${frontmatter.body}`;
  }

  return `---\n${nextYaml}---\n${content}`;
}

function dateRangeToEntry(
  filePath: string,
  fileName: string,
  dateKind: "actual" | "planned",
  range: { endDate: string; startDate: string },
  statuses: string[] = []
): GanttChartEntry {
  return {
    dateKind,
    endLabel: range.endDate,
    endValue: chartDateToDay(range.endDate),
    fileName,
    path: filePath,
    startLabel: range.startDate,
    startValue: chartDateToDay(range.startDate),
    statuses
  };
}

function readChartDateRange(yamlText: string, field: string): { endDate: string; startDate: string } | null {
  const values = readYamlArrayField(yamlText, field).map(normalizeChartDateValue);
  if (values.length !== 1 && values.length !== 2) return null;
  if (values.some((value) => value === null)) return null;

  const startDate = values[0];
  const endDate = values[1] ?? startDate;
  if (!startDate || !endDate) return null;
  if (startDate > endDate) return null;

  return { endDate, startDate };
}

function normalizeChartDateValue(value: string): string | null {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isDateString(trimmed) ? trimmed : null;
  }

  const date = new Date(trimmed.replace(/\s*\([^)]*\)\s*$/, ""));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function chartDateToDay(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);
}

function dateKindOrderForRenderer(kind: GanttChartEntry["dateKind"]): number {
  return kind === "actual" ? 1 : 0;
}

function fixedWorkspaceGanttCharts(charts: WorkspaceGanttChart[]): WorkspaceGanttChart[] {
  const chronicle = charts.find((chart) => chart.source === "chronicle" || chart.id === "chronicle");
  const date = charts.find((chart) => chart.source === "date" || chart.id === "date");

  return [
    {
      entries: chronicle?.entries ?? [],
      filePaths: chronicle?.filePaths ?? [],
      id: "chronicle",
      name: "chronicle",
      source: "chronicle"
    },
    {
      entries: date?.entries ?? [],
      filePaths: date?.filePaths ?? [],
      id: "date",
      name: "date",
      source: "date"
    }
  ];
}

function isWorkspaceGanttChart(value: unknown): value is WorkspaceGanttChart {
  if (typeof value !== "object" || value === null) return false;

  const chart = value as Record<string, unknown>;
  return (
    typeof chart.id === "string" &&
    typeof chart.name === "string" &&
    (chart.source === "chronicle" || chart.source === "date") &&
    Array.isArray(chart.entries) &&
    (!("filePaths" in chart) || Array.isArray(chart.filePaths))
  );
}

function legacyChronicleYearToAxis(year: number): number {
  return year < 0 ? year : year - 1;
}

function formatLegacyChronicleYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

function splitFrontmatterBlock(content: string): { body: string; close: string; open: string; yaml: string } | null {
  const open = /^---\r?\n/.exec(content);

  if (!open) return null;

  const rest = content.slice(open[0].length);
  const close = /^---(?:\r?\n|$)/m.exec(rest);

  if (!close || close.index === undefined) return null;

  return {
    body: rest.slice(close.index + close[0].length),
    close: close[0],
    open: open[0],
    yaml: rest.slice(0, close.index)
  };
}

function chartFrontmatterUpdates(yamlText: string, input: UpdateGanttChartEntryInput): Record<string, string[]> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);

  if (input.source === "date") {
    const startDate = chartDayToDate(start);
    const endDate = chartDayToDate(end);
    const dateField = input.dateKind === "actual" ? "actualDate" : "plannedDate";
    const updates: Record<string, string[]> = {
      chronicle: rangeToStringArray(dateYear(startDate), dateYear(endDate)),
      [dateField]: rangeToStringArray(startDate, endDate)
    };

    if (dateField === "plannedDate" && readYamlArrayField(yamlText, "date").length > 0) {
      updates.date = updates.plannedDate;
    }

    return updates;
  }

  const originalPlannedDate = readYamlArrayField(yamlText, "plannedDate");
  const originalLegacyDate = readYamlArrayField(yamlText, "date");
  const originalActualDate = readYamlArrayField(yamlText, "actualDate");
  const originalStartYear = chartAxisToYear(input.originalStartValue);
  const originalEndYear = chartAxisToYear(input.originalEndValue);
  const startYear = chartAxisToYear(start);
  const endYear = chartAxisToYear(end);
  const updates: Record<string, string[]> = {
    chronicle: rangeToStringArray(startYear, endYear)
  };

  const shiftDateRange = (values: string[]): string[] | null => {
    if (values.length !== 1 && values.length !== 2) return null;

    const startDate = values[0];
    const endDate = values[1] ?? startDate;

    if (isDateString(startDate) && isDateString(endDate)) {
      return rangeToStringArray(
        shiftDateYears(startDate, startYear - originalStartYear),
        shiftDateYears(endDate, endYear - originalEndYear)
      );
    }

    return null;
  };

  const plannedDate = shiftDateRange(originalPlannedDate.length > 0 ? originalPlannedDate : originalLegacyDate);
  const actualDate = shiftDateRange(originalActualDate);

  if (plannedDate) updates.plannedDate = plannedDate;
  if (plannedDate && originalLegacyDate.length > 0) updates.date = plannedDate;
  if (actualDate) updates.actualDate = actualDate;

  return updates;
}

function setYamlArrayField(yamlText: string, field: string, values: string[]): string {
  const line = `${field}: [${values.join(", ")}]\n`;
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*:.*(?:\\r?\\n|$)`, "m");

  if (pattern.test(yamlText)) {
    return yamlText.replace(pattern, line);
  }

  return `${yamlText}${yamlText.endsWith("\n") || yamlText.length === 0 ? "" : "\n"}${line}`;
}

function readYamlArrayField(yamlText: string, field: string): string[] {
  const pattern = new RegExp(`^${escapeRegExp(field)}\\s*:\\s*\\[([^\\]]*)\\]`, "m");
  const match = pattern.exec(yamlText);

  if (!match) return [];

  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function rangeToStringArray(start: string | number, end: string | number): string[] {
  return start === end ? [String(start)] : [String(start), String(end)];
}

function chartAxisToYear(value: number): number {
  return value < 0 ? value : value + 1;
}

function chartDayToDate(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const time = new Date(`${value}T00:00:00.000Z`).getTime();
  return !Number.isNaN(time) && chartDayToDate(Math.floor(time / 86_400_000)) === value;
}

function shiftDateYears(value: string, deltaYears: number): string {
  if (deltaYears === 0) return value;

  const date = new Date(`${value}T00:00:00.000Z`);
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const nextYear = date.getUTCFullYear() + deltaYears;
  const lastDay = new Date(Date.UTC(nextYear, month + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(nextYear, month, Math.min(day, lastDay)));

  return next.toISOString().slice(0, 10);
}

function dateYear(value: string): number {
  return Number(value.slice(0, 4));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
