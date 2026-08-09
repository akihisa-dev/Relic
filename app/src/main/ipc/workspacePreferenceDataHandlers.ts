import {
  getWorkspaceChronicleCalendarSettingsChannel,
  getWorkspaceFrontmatterCategoryChoicesChannel,
  saveWorkspaceChronicleCalendarSettingsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel
} from "../../shared/ipc";
import { defaultChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { fail } from "../../shared/result";
import { readWorkspaceSettings, updateWorkspaceSettings } from "../settings/workspaceSettings";
import { runWorkspaceRegistrationTask } from "../workspace/workspaceRegistrationGate";
import {
  getActiveWorkspaceContext,
  getRegisteredWorkspaceContext,
  ipcErrorDetails
} from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import {
  isSaveWorkspaceChronicleCalendarSettingsInput,
  isSaveWorkspaceFrontmatterCategoryChoicesInput
} from "./workspacePreferenceHandlerValidators";

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
      if (!isSaveWorkspaceFrontmatterCategoryChoicesInput(input)) {
        return fail("INVALID_FRONTMATTER_CATEGORY_CHOICES", "category候補が正しくありません。");
      }

      const savedChoices = input.choices.map((choice) => choice.trim());
      const saved = await runWorkspaceRegistrationTask(async () => {
        const context = await getRegisteredWorkspaceContext(input.workspaceId);
        if (!context.ok) return context;

        const workspaceSettings = await updateWorkspaceSettings(
          context.value.userDataPath,
          context.value.workspace.id,
          (workspaceSettings) => ({
            ...workspaceSettings,
            frontmatterCategoryChoices: savedChoices
          })
        );
        return { ok: true as const, value: workspaceSettings.frontmatterCategoryChoices };
      });
      if (!saved.ok) return saved;

      return saved;
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
      if (!isSaveWorkspaceChronicleCalendarSettingsInput(input)) return fail("INVALID_CHRONICLE_CALENDARS", "暦設定が正しくありません。");
      const saved = await runWorkspaceRegistrationTask(async () => {
        const context = await getRegisteredWorkspaceContext(input.workspaceId);
        if (!context.ok) return context;
        const settings = await updateWorkspaceSettings(
          context.value.userDataPath,
          context.value.workspace.id,
          (current) => ({ ...current, chronicleCalendarSettings: input.settings })
        );
        return { ok: true as const, value: settings.chronicleCalendarSettings ?? defaultChronicleCalendarSettings };
      });
      return saved;
    } catch (error) {
      return fail("WORKSPACE_CHRONICLE_CALENDARS_SAVE_FAILED", "暦設定を保存できませんでした。", ipcErrorDetails(error));
    }
  });
}
