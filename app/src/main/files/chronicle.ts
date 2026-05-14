import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GanttChartDateKind, GanttChartEntry, GanttChartSettings, UpdateGanttChartEntryInput, WorkspaceGanttChart, WorkspaceTreeNode } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "./fileTree";
import { parseFrontmatter, updateFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readWorkspaceChronicle(
  workspacePath: string,
  charts: GanttChartSettings[]
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const entriesBySource: Record<GanttChartSettings["source"], GanttChartEntry[]> = {
      chronicle: [],
      date: []
    };

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const range = extractChronicleRange(content);

      if (range) {
        entriesBySource.chronicle.push({
          endLabel: formatYear(range.endYear),
          endValue: yearToAxis(range.endYear),
          fileName: path.basename(relativePath, ".md"),
          path: relativePath,
          startLabel: formatYear(range.startYear),
          startValue: yearToAxis(range.startYear)
        });
      }

      const frontmatter = parseFrontmatter(content);
      const dateRanges: Array<{ kind: GanttChartDateKind; range: DateRange }> = [];
      const plannedDateRange = extractDateRangeFromData(frontmatter.data, "planned");
      const actualDateRange = extractDateRangeFromData(frontmatter.data, "actual");

      if (plannedDateRange) dateRanges.push({ kind: "planned", range: plannedDateRange });
      if (actualDateRange) dateRanges.push({ kind: "actual", range: actualDateRange });

      for (const { kind, range: dateRange } of dateRanges) {
        entriesBySource.date.push({
          dateKind: kind,
          endLabel: dateRange.endDate,
          endValue: dateToDay(dateRange.endDate),
          fileName: path.basename(relativePath, ".md"),
          path: relativePath,
          startLabel: dateRange.startDate,
          startValue: dateToDay(dateRange.startDate)
        });
      }
    }

    const sortedEntriesBySource = {
      chronicle: sortEntries(entriesBySource.chronicle),
      date: sortDateEntries(entriesBySource.date)
    };

    return ok(charts.map((chart) => ({
      ...chart,
      entries: sortedEntriesBySource[chart.source]
    })));
  } catch (error) {
    return fail(
      "CHRONICLE_READ_FAILED",
      "年表を読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function updateWorkspaceGanttChartEntry(
  workspacePath: string,
  charts: GanttChartSettings[],
  input: UpdateGanttChartEntryInput
): Promise<RelicResult<WorkspaceGanttChart[]>> {
  try {
    const absolutePath = resolveWorkspaceRelativePath(workspacePath, input.path);

    if (!absolutePath.ok) {
      return absolutePath;
    }

    if (path.extname(absolutePath.value) !== ".md") {
      return fail("GANTT_ENTRY_NOT_MARKDOWN", "Markdownファイル以外は更新できません。");
    }

    const content = await readFile(absolutePath.value, "utf8");
    const nextContent = updateFrontmatter(content, (data) =>
      updateChronicleDataForChartEdit(data, input)
    );

    await writeFile(absolutePath.value, nextContent, "utf8");

    return readWorkspaceChronicle(workspacePath, charts);
  } catch (error) {
    return fail(
      "GANTT_ENTRY_UPDATE_FAILED",
      "チャートの変更をファイルへ保存できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function sortEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) =>
    a.startValue - b.startValue ||
      a.endValue - b.endValue ||
      a.fileName.localeCompare(b.fileName, "ja")
  );
}

function sortDateEntries(entries: GanttChartEntry[]): GanttChartEntry[] {
  return [...entries].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, "ja") ||
      a.path.localeCompare(b.path, "ja") ||
      dateKindOrder(a.dateKind) - dateKindOrder(b.dateKind) ||
      a.startValue - b.startValue ||
      a.endValue - b.endValue
  );
}

function updateChronicleDataForChartEdit(
  data: Record<string, unknown>,
  input: UpdateGanttChartEntryInput
): Record<string, unknown> {
  const start = Math.min(input.startValue, input.endValue);
  const end = Math.max(input.startValue, input.endValue);

  if (input.source === "chronicle") {
    const originalStartYear = axisToYear(input.originalStartValue);
    const originalEndYear = axisToYear(input.originalEndValue);
    const startYear = axisToYear(start);
    const endYear = axisToYear(end);
    const next: Record<string, unknown> = {
      ...data,
      chronicle: rangeToArray(startYear, endYear)
    };
    for (const kind of ["planned", "actual"] as const) {
      const dateRange = extractDateRangeFromData(data, kind);

      if (dateRange) {
        const fieldName = dateFieldNameForKind(kind);
        const nextStartDate = shiftDateYears(dateRange.startDate, startYear - originalStartYear);
        const nextEndDate = shiftDateYears(dateRange.endDate, endYear - originalEndYear);
        const nextDateRange = rangeToArray(nextStartDate, nextEndDate);
        next[fieldName] = nextDateRange;

        if (kind === "planned" && Array.isArray(data.date)) {
          next.date = [...nextDateRange];
        }
      }
    }

    return normalizeDateFieldsForWrite(next);
  }

  const startDate = dayToDate(start);
  const endDate = dayToDate(end);
  const dateKind = input.dateKind ?? "planned";
  const fieldName = dateFieldNameForKind(dateKind);
  const next: Record<string, unknown> = {
    ...data,
    [fieldName]: rangeToArray(startDate, endDate)
  };

  if (dateKind === "planned" && Array.isArray(data.date)) {
    next.date = [...(next[fieldName] as string[])];
  }

  const startYear = dateYear(startDate);
  const endYear = dateYear(endDate);
  next.chronicle = rangeToArray(startYear, endYear);

  return normalizeDateFieldsForWrite(next);
}

export function extractChronicleRange(markdown: string): { endYear: number; startYear: number } | null {
  const { data } = parseFrontmatter(markdown);
  return extractChronicleRangeFromData(data);
}

function extractChronicleRangeFromData(data: Record<string, unknown>): { endYear: number; startYear: number } | null {
  const value = data.chronicle;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  if (!value.every(isValidChronicleYear)) return null;

  const startYear = value[0];
  const endYear = value.length === 1 ? startYear : value[1];

  if (startYear > endYear) return null;

  return { endYear, startYear };
}

interface DateRange {
  endDate: string;
  startDate: string;
}

export function extractDateRange(markdown: string): DateRange | null {
  const { data } = parseFrontmatter(markdown);
  return extractDateRangeFromData(data, "planned");
}

function extractDateRangeFromData(data: Record<string, unknown>, kind: GanttChartDateKind): DateRange | null {
  const value = kind === "planned" ? data.plannedDate ?? data.date : data.actualDate;

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  const dates = value.map(normalizeDateValue);
  if (dates.some((date) => date === null)) return null;

  const startDate = dates[0];
  const endDate = dates.length === 1 ? startDate : dates[1];
  if (!startDate || !endDate) return null;

  if (startDate > endDate) return null;

  return { endDate, startDate };
}

function dateFieldNameForKind(kind: GanttChartDateKind): "actualDate" | "plannedDate" {
  return kind === "actual" ? "actualDate" : "plannedDate";
}

function dateKindOrder(kind: GanttChartDateKind | undefined): number {
  if (kind === "actual") return 1;
  return 0;
}

function normalizeDateFieldsForWrite(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };

  for (const fieldName of ["date", "plannedDate", "actualDate"]) {
    const range = extractRawDateRangeFromData(data, fieldName);
    if (range) next[fieldName] = rangeToArray(range.startDate, range.endDate);
  }

  return next;
}

function extractRawDateRangeFromData(data: Record<string, unknown>, fieldName: string): DateRange | null {
  const value = data[fieldName];

  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 2)) return null;
  const dates = value.map(normalizeDateValue);
  if (dates.some((date) => date === null)) return null;

  const startDate = dates[0];
  const endDate = dates.length === 1 ? startDate : dates[1];
  if (!startDate || !endDate) return null;
  if (startDate > endDate) return null;

  return { endDate, startDate };
}

function rangeToArray<T>(start: T, end: T): T[] {
  return start === end ? [start] : [start, end];
}

function axisToYear(value: number): number {
  return value < 0 ? value : value + 1;
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

function isValidChronicleYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value !== 0;
}

function normalizeDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === trimmed ? trimmed : null;
}

function dateToDay(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 86_400_000);
}

function dayToDate(value: number): string {
  return new Date(value * 86_400_000).toISOString().slice(0, 10);
}

function yearToAxis(year: number): number {
  if (year === 0) return 0;
  return year < 0 ? year : year - 1;
}

function formatYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
