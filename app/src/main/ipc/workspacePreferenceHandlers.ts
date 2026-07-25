import { app } from "electron";

import {
  getFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
  type FrontmatterTemplate,
  type UserDefinedField
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings, updateAppSettings } from "../settings/appSettings";
import { ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import {
  isFrontmatterTemplatesInput,
  isUserDefinedFieldsInput
} from "./workspaceHandlerValidators";

export function registerWorkspacePreferenceHandlers(): void {
  handleLocalizedIpc(getUserDefinedFieldsChannel, async (): Promise<RelicResult<UserDefinedField[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.userDefinedFields);
    } catch (error) {
      return fail("USER_DEFINED_FIELDS_READ_FAILED", "カスタムフィールドを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  handleLocalizedIpc(saveUserDefinedFieldsChannel, async (_event, input: UserDefinedField[]): Promise<RelicResult<void>> => {
    try {
      if (!isUserDefinedFieldsInput(input)) {
        return fail("USER_DEFINED_FIELDS_INVALID_INPUT", "カスタムフィールドの値が正しくありません。");
      }

      await updateAppSettings(app.getPath("userData"), (settings) => ({
        ...settings,
        userDefinedFields: input
      }));
      return ok(undefined);
    } catch (error) {
      return fail("USER_DEFINED_FIELDS_SAVE_FAILED", "カスタムフィールドを保存できませんでした。", ipcErrorDetails(error));
    }
  });

  handleLocalizedIpc(getFrontmatterTemplatesChannel, async (): Promise<RelicResult<FrontmatterTemplate[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.frontmatterTemplates);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_READ_FAILED", "フロントマターテンプレートを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  handleLocalizedIpc(saveFrontmatterTemplatesChannel, async (_event, input: FrontmatterTemplate[]): Promise<RelicResult<void>> => {
    try {
      if (!isFrontmatterTemplatesInput(input)) {
        return fail("FRONTMATTER_TEMPLATES_INVALID_INPUT", "フロントマターテンプレートの値が正しくありません。");
      }

      await updateAppSettings(app.getPath("userData"), (settings) => ({
        ...settings,
        frontmatterTemplates: input
      }));
      return ok(undefined);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_SAVE_FAILED", "フロントマターテンプレートを保存できませんでした。", ipcErrorDetails(error));
    }
  });
}
