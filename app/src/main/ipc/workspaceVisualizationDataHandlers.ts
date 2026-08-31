import {
  getWorkspaceChartsChannel,
  getWorkspaceTableChannel,
  saveWorkspaceTablePreferencesChannel
} from "../../shared/ipc";
import { defaultChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { fail } from "../../shared/result";
import { readWorkspaceCharts } from "../files/charts";
import { workspaceDataProvider } from "../files/workspaceDataProvider";
import { readWorkspaceTable } from "../files/workspaceTable";
import { runWorkspaceRegistrationTask } from "../workspace/workspaceRegistrationGate";
import { readWorkspaceSettings, updateWorkspaceSettings } from "../settings/workspaceSettings";
import {
  getActiveWorkspaceContext,
  getRegisteredWorkspaceContext,
  ipcErrorDetails
} from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { isSaveWorkspaceTablePreferencesInput } from "./workspaceVisualizationHandlerValidators";

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
        workspaceSettings.tablePreferences,
        data.options
      );

      if (result.ok && !sameTablePreferences(result.value.preferences, workspaceSettings.tablePreferences)) {
        await runWorkspaceRegistrationTask(async () => {
          const registered = await getRegisteredWorkspaceContext(context.value.activeWorkspace.id);
          if (!registered.ok) return;
          await updateWorkspaceSettings(
            registered.value.userDataPath,
            registered.value.workspace.id,
            (settings) => sameTablePreferences(
              settings.tablePreferences,
              workspaceSettings.tablePreferences
            )
              ? { ...settings, tablePreferences: result.value.preferences }
              : settings
          );
        });
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

  handleLocalizedIpc(saveWorkspaceTablePreferencesChannel, async (_event, input: unknown) => {
    try {
      if (!isSaveWorkspaceTablePreferencesInput(input)) {
        return fail("INVALID_TABLE_PREFERENCES", "テーブルの表示設定が正しくありません。");
      }

      return await runWorkspaceRegistrationTask(async () => {
        const context = await getRegisteredWorkspaceContext(input.workspaceId);
        if (!context.ok) return context;
        const workspaceSettings = await updateWorkspaceSettings(
          context.value.userDataPath,
          context.value.workspace.id,
          (settings) => ({ ...settings, tablePreferences: input.preferences })
        );
        return { ok: true as const, value: workspaceSettings.tablePreferences };
      });
    } catch (error) {
      return fail(
        "WORKSPACE_TABLE_PREFERENCES_SAVE_FAILED",
        "テーブルの表示設定を保存できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

}

function sameTablePreferences(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
