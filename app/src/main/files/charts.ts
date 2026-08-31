import {
  type ChartEntry,
  type ChartSettings,
  type WorkspaceChart
} from "../../shared/ipc";
import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { calendarYearToBaseYear, defaultChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { pointToMonthAxis } from "../../shared/chartTime";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  sortChronicleEntries
} from "./chronicleData";
import { errorDetails } from "./fileSystem";
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

function isCalendarSettings(value: unknown): value is ChronicleCalendarSettings {
  return typeof value === "object" && value !== null && "baseCalendarName" in value;
}
