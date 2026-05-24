import { ipcMain } from "electron";

import {
  getFrontmatterValueCandidatesChannel,
  getWorkspaceAliasesChannel,
  getWorkspaceChronicleChannel,
  getWorkspaceChronicleCalendarsChannel,
  getWorkspaceTagsChannel,
  saveWorkspaceChronicleCalendarsChannel,
  saveWorkspaceGanttChartsChannel,
  updateGanttChartEntryChannel
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import { readWorkspaceAliases } from "../files/aliases";
import { readWorkspaceChronicle, updateWorkspaceGanttChartEntry } from "../files/chronicle";
import { readFrontmatterValueCandidates } from "../files/frontmatterCandidates";
import { readWorkspaceTags } from "../files/tags";
import { readWorkspaceSettings, writeWorkspaceSettings } from "../settings/workspaceSettings";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import {
  isChronicleCalendarsInput,
  isGanttChartsInput,
  isUpdateGanttChartEntryInput
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

  ipcMain.handle(getWorkspaceChronicleChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      return readWorkspaceChronicle(context.value.activeWorkspace.path, workspaceSettings.ganttCharts, workspaceSettings.chronicleCalendars);
    } catch (error) {
      return fail(
        "WORKSPACE_CHRONICLE_FAILED",
        "年表を読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(saveWorkspaceGanttChartsChannel, async (_event, input: unknown) => {
    try {
      if (!isGanttChartsInput(input)) {
        return fail("INVALID_GANTT_CHARTS", "年表設定が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      await writeWorkspaceSettings(context.value.userDataPath, context.value.activeWorkspace.id, {
        ...workspaceSettings,
        ganttCharts: input.map((chart) => ({
          filePaths: chart.filePaths,
          id: chart.id.trim(),
          name: chart.name.trim(),
          source: chart.source
        }))
      });

      return readWorkspaceChronicle(context.value.activeWorkspace.path, input, workspaceSettings.chronicleCalendars);
    } catch (error) {
      return fail(
        "WORKSPACE_GANTT_SAVE_FAILED",
        "年表設定を保存できませんでした。",
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

  ipcMain.handle(updateGanttChartEntryChannel, async (_event, input: unknown) => {
    try {
      if (!isUpdateGanttChartEntryInput(input)) {
        return fail("GANTT_ENTRY_UPDATE_INVALID_INPUT", "チャートの変更内容が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const workspaceSettings = await readWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id
      );
      return updateWorkspaceGanttChartEntry(
        context.value.activeWorkspace.path,
        workspaceSettings.ganttCharts,
        input,
        workspaceSettings.chronicleCalendars
      );
    } catch (error) {
      return fail(
        "GANTT_ENTRY_UPDATE_FAILED",
        "チャートの変更を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });
}
