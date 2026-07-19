import type { ChartSettings } from "../../shared/ipc";
import {
  getWorkspaceChartsChannel,
  getWorkspaceTableChannel,
  saveWorkspaceChartsChannel,
  saveWorkspaceTablePropertiesChannel,
  updateChartEntryChannel
} from "../../shared/ipc";
import { defaultChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { fail } from "../../shared/result";
import { readWorkspaceCharts, updateWorkspaceChartEntry } from "../files/charts";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { readWorkspaceTable } from "../files/workspaceTable";
import {
  normalizeWorkspaceRelativeSettingPath,
  readWorkspaceSettings,
  updateWorkspaceSettings
} from "../settings/workspaceSettings";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import {
  isChartsInput,
  isTablePropertiesInput,
  isUpdateChartEntryInput
} from "./workspaceHandlerValidators";

export function registerWorkspaceVisualizationDataHandlers(): void {
  handleLocalizedIpc(getWorkspaceChartsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });
      return readWorkspaceCharts(data.workspacePath, workspaceSettings.charts, workspaceSettings.chronicleCalendarSettings ?? defaultChronicleCalendarSettings, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_CHARTS_FAILED",
        "チャートを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
  handleLocalizedIpc(getWorkspaceTableChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });
      const result = await readWorkspaceTable(
        data.workspacePath,
        workspaceSettings.tableProperties ?? [],
        data.options
      );

      if (result.ok && !sameStrings(result.value.selectedProperties, workspaceSettings.tableProperties ?? [])) {
        await updateWorkspaceSettings(
          context.value.userDataPath,
          context.value.activeWorkspace.id,
          (settings) => ({ ...settings, tableProperties: result.value.selectedProperties })
        );
      }
      return result;
    } catch (error) {
      return fail(
        "WORKSPACE_TABLE_FAILED",
        "テーブルを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(saveWorkspaceChartsChannel, async (_event, input: unknown) => {
    try {
      if (!isChartsInput(input)) {
        return fail("INVALID_CHARTS", "チャート設定が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const savedCharts = normalizeChartSettingsForSave(input);
      const workspaceSettings = await updateWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id,
        (workspaceSettings) => ({
          ...workspaceSettings,
          charts: savedCharts
        })
      );
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceCharts(
        data.workspacePath,
        savedCharts,
        workspaceSettings.chronicleCalendarSettings ?? defaultChronicleCalendarSettings,
        data.options
      );
    } catch (error) {
      return fail(
        "WORKSPACE_CHARTS_SAVE_FAILED",
        "チャート設定を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
  handleLocalizedIpc(saveWorkspaceTablePropertiesChannel, async (_event, input: unknown) => {
    try {
      if (!isTablePropertiesInput(input)) {
        return fail("INVALID_TABLE_PROPERTIES", "テーブルの列設定が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const workspaceSettings = await updateWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id,
        (settings) => ({ ...settings, tableProperties: input })
      );
      return { ok: true as const, value: workspaceSettings.tableProperties };
    } catch (error) {
      return fail(
        "WORKSPACE_TABLE_PROPERTIES_SAVE_FAILED",
        "テーブルの列設定を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(updateChartEntryChannel, async (_event, input: unknown) => {
    try {
      if (!isUpdateChartEntryInput(input)) {
        return fail("CHART_ENTRY_UPDATE_INVALID_INPUT", "チャートの変更内容が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      const result = await updateWorkspaceChartEntry(
        context.value.activeWorkspace.path,
        workspaceSettings.charts,
        workspaceSettings.chronicleCalendarSettings ?? defaultChronicleCalendarSettings,
        input
      );
      if (result.ok) {
        invalidateWorkspaceData(context.value.activeWorkspace.id);
      }
      return result;
    } catch (error) {
      return fail(
        "CHART_ENTRY_UPDATE_FAILED",
        "チャートの変更を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeChartSettingsForSave(charts: ChartSettings[]): ChartSettings[] {
  return charts.map((chart) => ({
    filePaths: chart.filePaths?.flatMap((filePath) => {
      const normalized = normalizeWorkspaceRelativeSettingPath(filePath);
      return normalized ? [normalized] : [];
    }),
    id: chart.id.trim(),
    name: chart.name.trim(),
    source: chart.source
  }));
}
