import {
  getWorkspaceChronicleCalendarSettingsChannel,
  getWorkspaceFrontmatterCategoryChoicesChannel,
  saveWorkspaceChronicleCalendarSettingsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel
} from "../../shared/ipc";
import { defaultChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { fail } from "../../shared/result";
import { readWorkspaceSettings, updateWorkspaceSettings } from "../settings/workspaceSettings";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import {
  isChronicleCalendarSettingsInput,
  isFrontmatterCategoryChoicesInput
} from "./workspaceHandlerValidators";

export function registerWorkspacePreferenceDataHandlers(): void {
  handleLocalizedIpc(getWorkspaceFrontmatterCategoryChoicesChannel, async () => {
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

  handleLocalizedIpc(getWorkspaceChronicleCalendarSettingsChannel, async () => {
    try {
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const settings = await readWorkspaceSettings(context.value.userDataPath, context.value.activeWorkspace.id);
      return { ok: true as const, value: settings.chronicleCalendarSettings ?? defaultChronicleCalendarSettings };
    } catch (error) {
      return fail("WORKSPACE_CHRONICLE_CALENDARS_FAILED", "暦設定を読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  handleLocalizedIpc(saveWorkspaceFrontmatterCategoryChoicesChannel, async (_event, input: unknown) => {
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

  handleLocalizedIpc(saveWorkspaceChronicleCalendarSettingsChannel, async (_event, input: unknown) => {
    try {
      if (!isChronicleCalendarSettingsInput(input)) return fail("INVALID_CHRONICLE_CALENDARS", "暦設定が正しくありません。");
      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;
      const settings = await updateWorkspaceSettings(
        context.value.userDataPath,
        context.value.activeWorkspace.id,
        (current) => ({ ...current, chronicleCalendarSettings: input })
      );
      return { ok: true as const, value: settings.chronicleCalendarSettings ?? defaultChronicleCalendarSettings };
    } catch (error) {
      return fail("WORKSPACE_CHRONICLE_CALENDARS_SAVE_FAILED", "暦設定を保存できませんでした。", ipcErrorDetails(error));
    }
  });
}
