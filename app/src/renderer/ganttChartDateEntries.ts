import type { GanttChartEntry, WorkspaceGanttChart, WorkspaceTreeNode } from "../shared/ipc";
import { dateToDay, isDateString } from "../shared/chartTime";
import { collectMarkdownPaths } from "../shared/workspaceTree";
import type { GanttChartFileReader } from "./ganttChartApi";
import { splitFrontmatterBlock, readYamlArrayField } from "./ganttChartFrontmatter";
import { normalizeWorkspaceGanttCharts } from "./ganttChartNormalize";

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

    const plannedRange = readChartDateRange(frontmatter.yaml, "plannedDate");
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
    endValue: dateToDay(range.endDate),
    fileName,
    path: filePath,
    startLabel: range.startDate,
    startValue: dateToDay(range.startDate),
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

function dateKindOrderForRenderer(kind: GanttChartEntry["dateKind"]): number {
  return kind === "actual" ? 1 : 0;
}
