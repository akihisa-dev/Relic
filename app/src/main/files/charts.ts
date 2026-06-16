import { readFile } from "node:fs/promises";

import {
  defaultChronicleCalendars,
  type ChronicleCalendarSettings,
  type ChartEntry,
  type ChartSettings,
  type UpdateChartEntryInput,
  type WorkspaceChart
} from "../../shared/ipc";
import { updateChartFrontmatterContent } from "../../shared/chartFrontmatterUpdate";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import {
  collectChartEntriesForMarkdown,
  sortChronicleEntries,
  sortDateEntries
} from "./chronicleData";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath, resolveWorkspaceRelativePath } from "./paths";

export { extractChronicleRange, extractDateRange } from "./chronicleData";

interface ChartReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

interface ChartWriteOperations extends ChartReadOperations {
  writeTextFile(filePath: string, content: string): Promise<void>;
}

const defaultChartOperations: ChartWriteOperations = {
  readFile,
  writeTextFile: atomicWriteTextFile
};

export async function readWorkspaceCharts(
  workspacePath: string,
  charts: ChartSettings[],
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars,
  operations: ChartReadOperations = defaultChartOperations
): Promise<RelicResult<WorkspaceChart[]>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const entriesBySource: Record<ChartSettings["source"], ChartEntry[]> = {
      chronicle: [],
      date: []
    };
    const files = collectMarkdownPaths(fileTree).flatMap((relativePath) => {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);
      return absolutePath.ok ? [{ absolutePath: absolutePath.value, relativePath }] : [];
    });
    const fileContents = await Promise.all(
      files.map(async (file) => {
        try {
          return { ...file, content: await operations.readFile(file.absolutePath, "utf8") };
        } catch {
          return null;
        }
      })
    );

    for (const fileContent of fileContents) {
      if (!fileContent) continue;

      const { content, relativePath } = fileContent;
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
      errorDetails(error)
    );
  }
}

export async function updateWorkspaceChartEntry(
  workspacePath: string,
  charts: ChartSettings[],
  input: UpdateChartEntryInput,
  calendars: ChronicleCalendarSettings[] = defaultChronicleCalendars,
  operations: ChartWriteOperations = defaultChartOperations
): Promise<RelicResult<WorkspaceChart[]>> {
  try {
    if (!hasMarkdownExtension(input.path)) {
      return fail("CHART_ENTRY_NOT_MARKDOWN", "Markdownファイル以外は更新できません。");
    }

    const absolutePath = await resolveExistingWorkspacePath(workspacePath, input.path);

    if (!absolutePath.ok) {
      return absolutePath;
    }

    const content = await operations.readFile(absolutePath.value, "utf8");
    const nextContent = updateChartFrontmatterContent(content, input, calendars);

    if (!nextContent.ok) return nextContent;

    const currentContent = await operations.readFile(absolutePath.value, "utf8");

    if (currentContent !== content) {
      return fail(
        "CHART_ENTRY_UPDATE_CONFLICT",
        "ファイルが外部で変更されています。再読み込みしてからもう一度操作してください。"
      );
    }

    await operations.writeTextFile(absolutePath.value, nextContent.value);

    return readWorkspaceCharts(workspacePath, charts, calendars, operations);
  } catch (error) {
    return fail(
      "CHART_ENTRY_UPDATE_FAILED",
      "チャートの変更をファイルへ保存できませんでした。",
      errorDetails(error)
    );
  }
}
