import { readFile } from "node:fs/promises";

import {
  type ChartEntry,
  type ChartSettings,
  type UpdateChartEntryInput,
  type WorkspaceChart
} from "../../shared/ipc";
import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { calendarYearToBaseYear, defaultChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { pointToMonthAxis } from "../../shared/chartTime";
import { updateChartFrontmatterContent } from "../../shared/chartFrontmatterUpdate";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  sortChronicleEntries
} from "./chronicleData";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath } from "./paths";
import {
  chartEntriesForRecord,
  createWorkspaceDerivedDataCache,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";
import { finishPerformanceMeasure, startPerformanceMeasure } from "./performanceLog";

export { extractChronicleRange } from "./chronicleData";

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
  calendarSettingsOrOptions: ChronicleCalendarSettings | WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations | undefined = defaultChronicleCalendarSettings,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<WorkspaceChart[]>> {
  const calendarSettings = isCalendarSettings(calendarSettingsOrOptions)
    ? calendarSettingsOrOptions
    : defaultChronicleCalendarSettings;
  const derivedOptions = isCalendarSettings(calendarSettingsOrOptions) ? optionsOrOperations : calendarSettingsOrOptions ?? {};
  const startedAt = startPerformanceMeasure();
  try {
    const options = normalizeWorkspaceDerivedDataOptions(derivedOptions);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const entriesBySource: Record<ChartSettings["source"], ChartEntry[]> = { chronicle: [] };

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      const fileEntries = chartEntriesForRecord(record, parseCache);
      entriesBySource.chronicle.push(...fileEntries.chronicle.flatMap((entry) => {
        const calendarName = entry.calendarName ?? calendarSettings.baseCalendarName;
        const startYear = calendarYearToBaseYear(entry.startPoint.year, calendarName, calendarSettings);
        const endYear = calendarYearToBaseYear(entry.endPoint.year, calendarName, calendarSettings);
        if (startYear === null || endYear === null) return [];
        return [{
          ...entry,
          calendarName,
          startPoint: { month: null, year: startYear },
          endPoint: { month: null, year: endYear },
          startValue: pointToMonthAxis(startYear, null),
          endValue: pointToMonthAxis(endYear, null)
        }];
      }));
    }

    const sortedEntriesBySource = {
      chronicle: sortChronicleEntries(entriesBySource.chronicle)
    };

    const workspaceCharts = charts.map((chart) => ({
      ...chart,
      calendarSettings,
      entries: sortedEntriesBySource[chart.source]
    }));
    finishPerformanceMeasure("readWorkspaceCharts", startedAt, {
      charts: workspaceCharts.length,
      chronicleEntries: sortedEntriesBySource.chronicle.length,
      records: fileIndex.records.length
    });
    return ok(workspaceCharts);
  } catch (error) {
    finishPerformanceMeasure("readWorkspaceCharts", startedAt, { failed: true });
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
  calendarSettingsOrInput: ChronicleCalendarSettings | UpdateChartEntryInput,
  inputOrOperations?: UpdateChartEntryInput | ChartWriteOperations,
  operations: ChartWriteOperations = defaultChartOperations
): Promise<RelicResult<WorkspaceChart[]>> {
  const calendarSettings = isCalendarSettings(calendarSettingsOrInput)
    ? calendarSettingsOrInput
    : defaultChronicleCalendarSettings;
  const input = isCalendarSettings(calendarSettingsOrInput)
    ? inputOrOperations as UpdateChartEntryInput
    : calendarSettingsOrInput;
  const activeOperations = !isCalendarSettings(calendarSettingsOrInput) && inputOrOperations
    ? inputOrOperations as ChartWriteOperations
    : operations;
  try {
    if (!hasMarkdownExtension(input.path)) {
      return fail("CHART_ENTRY_NOT_MARKDOWN", "Markdownファイル以外は更新できません。");
    }

    const absolutePath = await resolveExistingWorkspacePath(workspacePath, input.path);

    if (!absolutePath.ok) {
      return absolutePath;
    }

    const content = await activeOperations.readFile(absolutePath.value, "utf8");
    const nextContent = updateChartFrontmatterContent(content, input, calendarSettings);

    if (!nextContent.ok) return nextContent;

    const currentContent = await activeOperations.readFile(absolutePath.value, "utf8");

    if (currentContent !== content) {
      return fail(
        "CHART_ENTRY_UPDATE_CONFLICT",
        "ファイルが外部で変更されています。再読み込みしてからもう一度操作してください。"
      );
    }

    await activeOperations.writeTextFile(absolutePath.value, nextContent.value);

    return readWorkspaceCharts(workspacePath, charts, calendarSettings, { operations: activeOperations });
  } catch (error) {
    return fail(
      "CHART_ENTRY_UPDATE_FAILED",
      "チャートの変更をファイルへ保存できませんでした。",
      errorDetails(error)
    );
  }
}

function isCalendarSettings(value: unknown): value is ChronicleCalendarSettings {
  return typeof value === "object" && value !== null && "baseCalendarName" in value;
}
