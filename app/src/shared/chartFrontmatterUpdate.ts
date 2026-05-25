import * as yaml from "js-yaml";

import { axisToYear, dayToDate, isDateString, rangeToStringArray, shiftDateYears } from "./chartTime";
import {
  defaultChronicleCalendars,
  type ChronicleCalendarId,
  type ChronicleCalendarSettings,
  type ChartDateKind,
  type UpdateChartEntryInput
} from "./ipcCharts";
import { fail, ok, type RelicResult } from "./result";

interface FrontmatterBlock {
  body: string;
  close: string;
  open: string;
  yaml: string;
}

export function updateChartFrontmatterContent(
  content: string,
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): RelicResult<string> {
  const frontmatter = splitFrontmatterBlock(content);

  if (!frontmatter) {
    return fail(
      "CHART_FRONTMATTER_MISSING",
      "チャート対象のフロントマターが見つからないため、変更を保存できませんでした。"
    );
  }

  const data = parseYamlObject(frontmatter.yaml);
  if (!data.ok) return data;

  const updates = chartFrontmatterUpdates(data.value, input, calendars);
  if (!updates.ok) return updates;

  const nextYaml = Object.entries(updates.value).reduce(
    (yamlText, [field, values]) => setYamlArrayField(yamlText, field, values),
    frontmatter.yaml
  );

  return ok(`${frontmatter.open}${nextYaml}${frontmatter.close}${frontmatter.body}`);
}

export function splitFrontmatterBlock(content: string): FrontmatterBlock | null {
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

function parseYamlObject(yamlText: string): RelicResult<Record<string, unknown>> {
  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) return ok({});
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return fail(
        "CHART_FRONTMATTER_INVALID",
        "フロントマターが正しいYAMLオブジェクトではないため、チャートの変更を保存できませんでした。"
      );
    }

    return ok(parsed as Record<string, unknown>);
  } catch (error) {
    return fail(
      "CHART_FRONTMATTER_INVALID",
      "フロントマターが壊れているため、チャートの変更を保存できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function chartFrontmatterUpdates(
  data: Record<string, unknown>,
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[]
): RelicResult<Record<string, string[]>> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);

  if (input.source === "date") {
    const startDate = dayToDate(start);
    const endDate = dayToDate(end);
    const dateField = dateFieldNameForKind(input.dateKind ?? "planned");

    return ok({
      chronicle0: rangeToStringArray(dateYear(startDate), dateYear(endDate)),
      [dateField]: rangeToStringArray(startDate, endDate)
    });
  }

  const originalStartYear = axisToYear(input.originalStartValue);
  const originalEndYear = axisToYear(input.originalEndValue);
  const startYear = axisToYear(start);
  const endYear = axisToYear(end);
  const calendar = calendarForInput(input, calendars);

  if (!calendar.ok) return calendar;

  const nextStartYear = mainYearToCalendarYear(calendar.value, startYear);
  const nextEndYear = mainYearToCalendarYear(calendar.value, endYear);
  const updates: Record<string, string[]> = {
    [calendar.value.id]: rangeToStringArray(nextStartYear, nextEndYear)
  };

  for (const kind of ["planned", "actual"] as const) {
    const dateRange = extractDateRangeFromData(data, kind);

    if (dateRange) {
      const fieldName = dateFieldNameForKind(kind);
      updates[fieldName] = rangeToStringArray(
        shiftDateYears(dateRange.startDate, startYear - originalStartYear),
        shiftDateYears(dateRange.endDate, endYear - originalEndYear)
      );
    }
  }

  return ok(updates);
}

function calendarForInput(
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[]
): RelicResult<{ id: ChronicleCalendarId; startYear: number }> {
  const id = input.chronicleCalendarId ?? "chronicle0";

  if (id === "chronicle0") return ok({ id, startYear: 1 });

  const configuredStartYear = calendars.find((calendar) => calendar.id === id)?.startYear;
  const startYear = Number.isInteger(configuredStartYear) && Number(configuredStartYear) >= 1
    ? configuredStartYear
    : input.chronicleCalendarStartYear;

  if (!Number.isInteger(startYear) || Number(startYear) < 1) {
    return fail(
      "CHART_CHRONICLE_CALENDAR_MISSING",
      "サブ暦の開始年が分からないため、チャートの変更を保存できませんでした。"
    );
  }

  return ok({ id, startYear: Number(startYear) });
}

function setYamlArrayField(yamlText: string, field: string, values: string[]): string {
  const line = `${field}: [${values.join(", ")}]`;
  const range = findTopLevelFieldRange(yamlText, field);

  if (!range) {
    return `${yamlText}${yamlText.endsWith("\n") || yamlText.length === 0 ? "" : "\n"}${line}\n`;
  }

  const existingLine = yamlText.slice(range.from, range.lineEnd).replace(/\r?\n$/, "");
  const comment = trailingComment(existingLine);
  const replacement = `${line}${comment}\n`;

  return `${yamlText.slice(0, range.from)}${replacement}${yamlText.slice(range.to)}`;
}

function findTopLevelFieldRange(
  yamlText: string,
  field: string
): { from: number; lineEnd: number; to: number } | null {
  const pattern = new RegExp(`(^|\\n)${escapeRegExp(field)}\\s*:`);
  const match = pattern.exec(yamlText);

  if (!match || match.index === undefined) return null;

  const from = match.index + (match[1] === "\n" ? 1 : 0);
  const lineEnd = nextLineEnd(yamlText, from);
  let to = lineEnd;

  while (to < yamlText.length) {
    const candidateEnd = nextLineEnd(yamlText, to);
    const line = yamlText.slice(to, candidateEnd);

    if (!/^[ \t]/.test(line)) break;

    to = candidateEnd;
  }

  return { from, lineEnd, to };
}

function nextLineEnd(text: string, from: number): number {
  const nextNewline = text.indexOf("\n", from);
  return nextNewline === -1 ? text.length : nextNewline + 1;
}

function trailingComment(line: string): string {
  const match = /(\s+#.*)$/.exec(line);
  return match ? match[1] : "";
}

function extractDateRangeFromData(data: Record<string, unknown>, kind: ChartDateKind): { endDate: string; startDate: string } | null {
  const value = kind === "planned" ? data.plannedDate : data.actualDate;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  const dates = value.map(normalizeDateValue);
  if (dates.some((date) => date === null)) return null;

  const startDate = dates[0];
  const endDate = dates.length === 1 ? startDate : dates[1];
  if (!startDate || !endDate || startDate > endDate) return null;

  return { endDate, startDate };
}

function normalizeDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (isDateString(trimmed)) return trimmed;

  const fallbackDate = new Date(trimmed.replace(/\s*\([^)]*\)\s*$/, ""));
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate.toISOString().slice(0, 10);
}

function dateFieldNameForKind(kind: ChartDateKind): "actualDate" | "plannedDate" {
  return kind === "actual" ? "actualDate" : "plannedDate";
}

function dateYear(value: string): number {
  return Number(value.slice(0, 4));
}

function mainYearToCalendarYear(calendar: { startYear: number }, mainYear: number): number {
  return mainYear - calendar.startYear + 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
