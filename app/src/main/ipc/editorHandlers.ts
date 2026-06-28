import { app, clipboard, ipcMain } from "electron";

import {
  copyEditorTextToClipboardChannel,
  getEditorSettingsChannel,
  saveEditorSettingsChannel,
  type CopyEditorTextToClipboardInput,
  type EditorSettings,
  writeMarkdownFileChannel,
  type WriteMarkdownFileInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { writeMarkdownFileContent } from "../files/markdownFiles";
import { readAppSettings, updateAppSettings } from "../settings/appSettings";
import { ipcErrorDetails, withActiveWorkspaceContext } from "./activeWorkspace";
import {
  isCopyEditorTextToClipboardInput,
  isEditorSettingsInput
} from "./editorHandlerValidators";
import { isWriteMarkdownFileInput } from "./fileHandlerValidators";

export function registerEditorHandlers(): void {
  ipcMain.handle(
    writeMarkdownFileChannel,
    async (_event, input: WriteMarkdownFileInput): Promise<RelicResult<void>> => {
      try {
        if (!isWriteMarkdownFileInput(input)) {
          return fail("FILE_WRITE_INVALID_INPUT", "パスと内容を指定してください。");
        }

        return withActiveWorkspaceContext(
          { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" },
          async (context) => writeMarkdownFileContent(
            context.activeWorkspace.path,
            input.path,
            input.content,
            input.expectedContent
          )
        );
      } catch (error) {
        return fail(
          "FILE_WRITE_FAILED",
          "ファイルを保存できませんでした。",
          ipcErrorDetails(error)
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
          ipcErrorDetails(error)
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

        await updateAppSettings(app.getPath("userData"), (settings) => ({
          ...settings,
          editorSettings: input
        }));

        return ok(undefined);
      } catch (error) {
        return fail(
          "EDITOR_SETTINGS_SAVE_FAILED",
          "エディタ設定を保存できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(
    copyEditorTextToClipboardChannel,
    async (_event, input: CopyEditorTextToClipboardInput): Promise<RelicResult<void>> => {
      try {
        if (!isCopyEditorTextToClipboardInput(input)) {
          return fail(
            "EDITOR_CLIPBOARD_INVALID_INPUT",
            "コピーするテキストを指定してください。"
          );
        }

        clipboard.writeText(input.text);
        return ok(undefined);
      } catch (error) {
        return fail(
          "EDITOR_CLIPBOARD_WRITE_FAILED",
          "クリップボードへコピーできませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}
