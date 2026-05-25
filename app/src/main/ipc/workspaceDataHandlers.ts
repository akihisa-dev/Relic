import { ipcMain } from "electron";

import {
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChartsChannel,
  getWorkspaceChronicleCalendarsChannel,
  getWorkspaceTagsChannel,
  saveWorkspaceChronicleCalendarsChannel,
  saveWorkspaceChartsChannel,
  updateChartEntryChannel
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import { readWorkspaceAliases } from "../files/aliases";
import { readWorkspaceCharts, updateWorkspaceChartEntry } from "../files/charts";
import { readFrontmatterValueCandidates } from "../files/frontmatterCandidates";
import { readWorkspaceTags } from "../files/tags";
import { readWorkspaceSettings, writeWorkspaceSettings } from "../settings/workspaceSettings";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import {
  isChronicleCalendarsInput,
  isChartsInput,
  isUpdateChartEntryInput
} from "./workspaceHandlerValidators";

export function registerWorkspaceDataHandlers(): void {
  ipcMain.handle(getWorkspaceTagsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return readWorkspaceTags(context.value.activeWorkspace.path);
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

      return readFrontmatterValueCandidates(context.value.activeWorkspace.path);
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

      return readWorkspaceAliases(context.value.activeWorkspace.path);
    } catch (error) {
      return fail(
        "WORKSPACE_ALIASES_FAILED",
        "別名を読み込めませんでした。",
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
      return readWorkspaceCharts(context.value.activeWorkspace.path, workspaceSettings.charts, workspaceSettings.chronicleCalendars);
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

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      await writeWorkspaceSettings(context.value.userDataPath, context.value.activeWorkspace.id, {
        ...workspaceSettings,
        charts: input.map((chart) => ({
          filePaths: chart.filePaths,
          id: chart.id.trim(),
          name: chart.name.trim(),
          source: chart.source
        }))
      });

      return readWorkspaceCharts(context.value.activeWorkspace.path, input, workspaceSettings.chronicleCalendars);
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

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      await writeWorkspaceSettings(context.value.userDataPath, context.value.activeWorkspace.id, {
        ...workspaceSettings,
        chronicleCalendars: input.map((calendar) => ({
          id: calendar.id,
          name: calendar.name.trim(),
          ...(calendar.id === "chronicle0" ? {} : { startYear: calendar.startYear })
        }))
      });

      return { ok: true as const, value: input };
    } catch (error) {
      return fail(
        "WORKSPACE_CHRONICLE_CALENDARS_SAVE_FAILED",
        "暦設定を保存できませんでした。",
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
      return updateWorkspaceChartEntry(
        context.value.activeWorkspace.path,
        workspaceSettings.charts,
        input,
        workspaceSettings.chronicleCalendars
      );
    } catch (error) {
      return fail(
        "CHART_ENTRY_UPDATE_FAILED",
        "チャートの変更を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
}
