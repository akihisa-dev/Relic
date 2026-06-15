import { app, ipcMain } from "electron";

import {
  getEditorSettingsChannel,
  saveEditorSettingsChannel,
  type EditorSettings,
  writeMarkdownFileChannel,
  type WriteMarkdownFileInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { redactSensitiveText } from "../../shared/securityRedaction";
import { writeMarkdownFileContent } from "../files/markdownFiles";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { toWorkspaceState } from "../workspace/workspaceService";
import { isEditorSettingsInput } from "./editorHandlerValidators";
import { isWriteMarkdownFileInput } from "./fileHandlerValidators";

export function registerEditorHandlers(): void {
  ipcMain.handle(
    writeMarkdownFileChannel,
    async (_event, input: WriteMarkdownFileInput): Promise<RelicResult<void>> => {
      try {
        if (!isWriteMarkdownFileInput(input)) {
          return fail("FILE_WRITE_INVALID_INPUT", "パスと内容を指定してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        return writeMarkdownFileContent(state.activeWorkspace.path, input.path, input.content, input.expectedContent);
      } catch (error) {
        return fail(
          "FILE_WRITE_FAILED",
          "ファイルを保存できませんでした。",
          errorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(
    getEditorSettingsChannel,
    async (): Promise<RelicResult<EditorSettings>> => {
      try {
        const settings = await readAppSettings(app.getPath("userData"));

        return ok(settings.editorSettings);
      } catch (error) {
        return fail(
          "EDITOR_SETTINGS_READ_FAILED",
          "エディタ設定を読み込めませんでした。",
          errorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(
    saveEditorSettingsChannel,
    async (_event, input: unknown): Promise<RelicResult<void>> => {
      try {
        if (!isEditorSettingsInput(input)) {
          return fail("EDITOR_SETTINGS_INVALID", "無効なエディタ設定です。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        await writeAppSettings(app.getPath("userData"), { ...settings, editorSettings: input });

        return ok(undefined);
      } catch (error) {
        return fail(
          "EDITOR_SETTINGS_SAVE_FAILED",
          "エディタ設定を保存できませんでした。",
          errorDetails(error)
        );
      }
    }
  );
}

function errorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message);
}
