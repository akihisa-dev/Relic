import { app, ipcMain } from "electron";

import {
  getEditorSettingsChannel,
  saveEditorSettingsChannel,
  type EditorSettings,
  writeMarkdownCardChannel,
  type WriteMarkdownCardInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readMarkdownCard } from "../cards/markdownCards";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveCardbookRelativePath } from "../cards/paths";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import { toCardbookState } from "../cardbook/cardbookService";

export function registerEditorHandlers(): void {
  ipcMain.handle(
    writeMarkdownCardChannel,
    async (_event, input: WriteMarkdownCardInput): Promise<RelicResult<void>> => {
      try {
        if (!isWriteMarkdownCardInput(input)) {
          return fail("FILE_WRITE_INVALID_INPUT", "パスと内容を指定してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toCardbookState(settings);

        if (!state.activeCardbook) {
          return fail("CARDBOOK_NOT_SELECTED", "先にカードブックを開いてください。");
        }

        const resolved = resolveCardbookRelativePath(state.activeCardbook.path, input.path);

        if (!resolved.ok) {
          return resolved;
        }

        if (path.extname(resolved.value) !== ".md") {
          return fail("FILE_WRITE_NOT_MARKDOWN", "Markdown形式のカード以外は書き込めません。");
        }

        await writeFile(resolved.value, input.content, "utf8");

        return ok(undefined);
      } catch (error) {
        return fail(
          "FILE_WRITE_FAILED",
          "カードを保存できませんでした。",
          error instanceof Error ? error.message : String(error)
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
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    saveEditorSettingsChannel,
    async (_event, input: EditorSettings): Promise<RelicResult<void>> => {
      try {
        if (!isEditorSettings(input)) {
          return fail("EDITOR_SETTINGS_INVALID", "無効なエディタ設定です。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        await writeAppSettings(app.getPath("userData"), { ...settings, editorSettings: input });

        return ok(undefined);
      } catch (error) {
        return fail(
          "EDITOR_SETTINGS_SAVE_FAILED",
          "エディタ設定を保存できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
}

function isWriteMarkdownCardInput(input: unknown): input is WriteMarkdownCardInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "content" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { content?: unknown }).content === "string"
  );
}

function isEditorSettings(input: unknown): input is EditorSettings {
  if (typeof input !== "object" || input === null) return false;

  const s = input as Record<string, unknown>;

  return (
    (s.font === "system" || s.font === "mincho" || s.font === "mono") &&
    typeof s.fontSize === "number" &&
    typeof s.lineHeight === "number" &&
    (s.maxWidth === "550px" || s.maxWidth === "660px" || s.maxWidth === "800px" || s.maxWidth === "none") &&
    typeof s.showLineNumbers === "boolean" &&
    typeof s.spellCheck === "boolean"
  );
}
