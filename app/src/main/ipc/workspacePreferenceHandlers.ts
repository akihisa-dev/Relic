import { app, ipcMain } from "electron";

import {
  defaultAppUiSettings,
  defaultFeatureToggles,
  getAppUiSettingsChannel,
  getFeatureTogglesChannel,
  getFrontmatterTemplatesChannel,
  getUserDefinedFieldsChannel,
  saveAppUiSettingsChannel,
  saveFeatureTogglesChannel,
  saveFrontmatterTemplatesChannel,
  saveUserDefinedFieldsChannel,
  type AppUiSettings,
  type FeatureToggles,
  type FrontmatterTemplate,
  type UserDefinedField
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { ipcErrorDetails } from "./activeWorkspace";
import {
  isAppUiSettingsInput,
  isFeatureTogglesInput,
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

  ipcMain.handle(getAppUiSettingsChannel, async (): Promise<RelicResult<AppUiSettings>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));
      return ok(settings.uiSettings ?? defaultAppUiSettings);
    } catch (error) {
      return fail("APP_UI_SETTINGS_READ_FAILED", "画面設定を読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveAppUiSettingsChannel, async (_event, input: unknown): Promise<RelicResult<AppUiSettings>> => {
    try {
      if (!isAppUiSettingsInput(input)) {
        return fail("APP_UI_SETTINGS_INVALID_INPUT", "画面設定の値が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = { ...settings.uiSettings, ...input };
      await writeAppSettings(app.getPath("userData"), { ...settings, uiSettings: nextSettings });
      return ok(nextSettings);
    } catch (error) {
      return fail("APP_UI_SETTINGS_SAVE_FAILED", "画面設定を保存できませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveFeatureTogglesChannel, async (_event, input: unknown): Promise<RelicResult<void>> => {
    try {
      if (!isFeatureTogglesInput(input)) {
        return fail("FEATURE_TOGGLES_INVALID_INPUT", "機能トグルの値が正しくありません。");
      }

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
      return fail("FRONTMATTER_TEMPLATES_READ_FAILED", "フロントマターテンプレートを読み込めませんでした。", ipcErrorDetails(error));
    }
  });

  ipcMain.handle(saveFrontmatterTemplatesChannel, async (_event, input: FrontmatterTemplate[]): Promise<RelicResult<void>> => {
    try {
      if (!isFrontmatterTemplatesInput(input)) {
        return fail("FRONTMATTER_TEMPLATES_INVALID_INPUT", "フロントマターテンプレートの値が正しくありません。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      await writeAppSettings(app.getPath("userData"), { ...settings, frontmatterTemplates: input });
      return ok(undefined);
    } catch (error) {
      return fail("FRONTMATTER_TEMPLATES_SAVE_FAILED", "フロントマターテンプレートを保存できませんでした。", ipcErrorDetails(error));
    }
  });
}
