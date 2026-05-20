import { app, ipcMain } from "electron";

import {
  defaultFeatureToggles,
  getFeatureTogglesChannel,
  getFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveFeatureTogglesChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
  type FeatureToggles,
  type FrontmatterTemplate,
  type UserDefinedField
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { ipcErrorDetails } from "./activeWorkspace";
import {
  isFrontmatterTemplatesInput,
  isUserDefinedFieldsInput
} from "./workspaceHandlerValidators";

export function registerWorkspacePreferenceHandlers(): void {
  ipcMain.handle(getFeatureTogglesChannel, async (): Promise<RelicResult<FeatureToggles>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.featureToggles ?? defaultFeatureToggles);
    } catch (error) {
      return fail("FEATURE_TOGGLES_READ_FAILED", "機能トグルを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveFeatureTogglesChannel, async (_event, input: FeatureToggles): Promise<RelicResult<void>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, featureToggles: input });
      return ok(undefined);
    } catch (error) {
      return fail("FEATURE_TOGGLES_SAVE_FAILED", "機能トグルを保存できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(getUserDefinedFieldsChannel, async (): Promise<RelicResult<UserDefinedField[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.userDefinedFields);
    } catch (error) {
      return fail("USER_DEFINED_FIELDS_READ_FAILED", "カスタムフィールドを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveUserDefinedFieldsChannel, async (_event, input: UserDefinedField[]): Promise<RelicResult<void>> => {
    try {
      if (!isUserDefinedFieldsInput(input)) {
        return fail("USER_DEFINED_FIELDS_INVALID_INPUT", "カスタムフィールドの値が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, userDefinedFields: input });
      return ok(undefined);
    } catch (error) {
      return fail("USER_DEFINED_FIELDS_SAVE_FAILED", "カスタムフィールドを保存できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(getFrontmatterTemplatesChannel, async (): Promise<RelicResult<FrontmatterTemplate[]>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.frontmatterTemplates);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_READ_FAILED", "プロパティテンプレートを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveFrontmatterTemplatesChannel, async (_event, input: FrontmatterTemplate[]): Promise<RelicResult<void>> => {
    try {
      if (!isFrontmatterTemplatesInput(input)) {
        return fail("FRONTMATTER_TEMPLATES_INVALID_INPUT", "プロパティテンプレートの値が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, frontmatterTemplates: input });
      return ok(undefined);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_SAVE_FAILED", "プロパティテンプレートを保存できませんでした。", ipcErrorDetails(error));
    }
  });
}
