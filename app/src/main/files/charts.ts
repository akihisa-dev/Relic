import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartEntry,
  type ChartSettings,
  type UpdateChartEntryInput,
  type WorkspaceChart
} from "../../shared/ipc";
import { updateChartFrontmatterContent } from "../../shared/chartFrontmatterUpdate";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import {
  collectChartEntriesForMarkdown,
  sortChronicleEntries,
  sortDateEntries
} from "./chronicleData";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

export { extractChronicleRange, extractDateRange } from "./chronicleData";

export async function readWorkspaceCharts(
  workspacePath: string,
  charts: ChartSettings[],
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Promise<RelicResult<WorkspaceChart[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const entriesBySource: Record<ChartSettings["source"], ChartEntry[]> = {
      chronicle: [],
      date: []
    };

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const fileEntries = collectChartEntriesForMarkdown(relativePath, content, calendars);
      entriesBySource.chronicle.push(...fileEntries.chronicle);
      entriesBySource.date.push(...fileEntries.date);
    }

    const sortedEntriesBySource = {
      chronicle: sortChronicleEntries(entriesBySource.chronicle),
      date: sortDateEntries(entriesBySource.date)
    };

    return ok(charts.map((chart) => ({
      ...chart,
      entries: sortedEntriesBySource[chart.source]
    })));
  } catch (error) {
    return fail(
      "CHRONICLE_READ_FAILED",
      "チャートを読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function updateWorkspaceChartEntry(
  workspacePath: string,
  charts: ChartSettings[],
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars
): Promise<RelicResult<WorkspaceChart[]>> {
  try {
    const absolutePath = resolveWorkspaceRelativePath(workspacePath, input.path);

    if (!absolutePath.ok) {
      return absolutePath;
    }

    if (path.extname(absolutePath.value) !== ".md") {
      return fail("CHART_ENTRY_NOT_MARKDOWN", "Markdownファイル以外は更新できません。");
    }

    const content = await readFile(absolutePath.value, "utf8");
    const nextContent = updateChartFrontmatterContent(content, input, calendars);

    if (!nextContent.ok) return nextContent;

    await writeFile(absolutePath.value, nextContent.value, "utf8");

    return readWorkspaceCharts(workspacePath, charts, calendars);
  } catch (error) {
    return fail(
      "CHART_ENTRY_UPDATE_FAILED",
      "チャートの変更をファイルへ保存できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}
