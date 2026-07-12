import { ipcMain } from "electron";

import type { ChartSettings, ChronicleCalendarSettings } from "../../shared/ipc";
import {
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChartsChannel,
  getWorkspaceChronicleCalendarsChannel,
  getWorkspaceFrontmatterCategoryChoicesChannel,
  getWorkspaceGraphChannel,
  getWorkspaceTagsChannel,
  saveWorkspaceChronicleCalendarsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel,
  saveWorkspaceChartsChannel,
  updateChartEntryChannel
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import { readWorkspaceAliases } from "../files/aliases";
import { readWorkspaceCharts, updateWorkspaceChartEntry } from "../files/charts";
import { readFrontmatterValueCandidates } from "../files/frontmatterCandidates";
import { readWorkspaceGraph } from "../files/workspaceGraph";
import { readWorkspaceTags } from "../files/tags";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import {
  normalizeWorkspaceRelativeSettingPath,
  readWorkspaceSettings,
  updateWorkspaceSettings
} from "../settings/workspaceSettings";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import {
  isChronicleCalendarsInput,
  isChartsInput,
  isFrontmatterCategoryChoicesInput,
  isUpdateChartEntryInput
} from "./workspaceHandlerValidators";

export function registerWorkspaceDataHandlers(): void {
  ipcMain.handle(getWorkspaceTagsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceTags(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "TAGS_READ_FAILED",
        "タグを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getFrontmatterValueCandidatesChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readFrontmatterValueCandidates(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "FRONTMATTER_VALUE_CANDIDATES_READ_FAILED",
        "フロントマター候補を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceAliasesChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceAliases(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_ALIASES_FAILED",
        "別名を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceGraphChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const data = await workspaceDataProvider.get({
        userDataPath: context.value.userDataPath,
        workspaceId: context.value.activeWorkspace.id,
        workspacePath: context.value.activeWorkspace.path
      });

      return readWorkspaceGraph(data.workspacePath, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_GRAPH_FAILED",
        "グラフを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceChartsChannel, async () => {
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
      return readWorkspaceCharts(data.workspacePath, workspaceSettings.charts, undefined, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_CHARTS_FAILED",
        "チャートを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(saveWorkspaceChartsChannel, async (_event, input: unknown) => {
    try {
      if (!isChartsInput(input)) {
        return fail("INVALID_CHARTS", "チャート設定が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const savedCharts = normalizeChartSettingsForSave(input);
      await updateWorkspaceSettings(
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

      return readWorkspaceCharts(data.workspacePath, savedCharts, undefined, data.options);
    } catch (error) {
      return fail(
        "WORKSPACE_CHARTS_SAVE_FAILED",
        "チャート設定を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceChronicleCalendarsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      return { ok: true as const, value: workspaceSettings.chronicleCalendars };
    } catch (error) {
      return fail(
        "WORKSPACE_CHRONICLE_CALENDARS_FAILED",
        "暦設定を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(saveWorkspaceChronicleCalendarsChannel, async (_event, input: unknown) => {
    try {
      if (!isChronicleCalendarsInput(input)) {
        return fail("INVALID_CHRONICLE_CALENDARS", "暦設定が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const savedCalendars = normalizeChronicleCalendarsForSave(input);
      await updateWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id,
        (workspaceSettings) => ({
          ...workspaceSettings,
          chronicleCalendars: savedCalendars
        })
      );
      invalidateWorkspaceData(context.value.activeWorkspace.id);

      return { ok: true as const, value: savedCalendars };
    } catch (error) {
      return fail(
        "WORKSPACE_CHRONICLE_CALENDARS_SAVE_FAILED",
        "暦設定を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getWorkspaceFrontmatterCategoryChoicesChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      return { ok: true as const, value: workspaceSettings.frontmatterCategoryChoices };
    } catch (error) {
      return fail(
        "WORKSPACE_FRONTMATTER_CATEGORY_CHOICES_FAILED",
        "category候補を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(saveWorkspaceFrontmatterCategoryChoicesChannel, async (_event, input: unknown) => {
    try {
      if (!isFrontmatterCategoryChoicesInput(input)) {
        return fail("INVALID_FRONTMATTER_CATEGORY_CHOICES", "category候補が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const savedChoices = input.map((choice) => choice.trim());
      const workspaceSettings = await updateWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id,
        (workspaceSettings) => ({
          ...workspaceSettings,
          frontmatterCategoryChoices: savedChoices
        })
      );

      return { ok: true as const, value: workspaceSettings.frontmatterCategoryChoices };
    } catch (error) {
      return fail(
        "WORKSPACE_FRONTMATTER_CATEGORY_CHOICES_SAVE_FAILED",
        "category候補を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(updateChartEntryChannel, async (_event, input: unknown) => {
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
        input,
        workspaceSettings.chronicleCalendars
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

function normalizeChronicleCalendarsForSave(
  calendars: ChronicleCalendarSettings[]
): ChronicleCalendarSettings[] {
  return calendars.map((calendar) => ({
    name: calendar.name.trim(),
    ...(calendar.startYear === undefined ? {} : { startYear: calendar.startYear })
  }));
}
