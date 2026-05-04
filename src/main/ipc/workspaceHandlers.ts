import { app, dialog, ipcMain } from "electron";

import {
  createFolderChannel,
  type CreateFolderInput,
  createMarkdownFileChannel,
  type CreateMarkdownFileInput,
  getWorkspaceStateChannel,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  type ReadMarkdownFileInput,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "../files/fileTree";
import { createFolder } from "../files/folders";
import { createMarkdownFile, readMarkdownFile } from "../files/markdownFiles";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import {
  addOrActivateWorkspace,
  createWorkspaceSummary,
  prepareWorkspace,
  toWorkspaceState
} from "../workspace/workspaceService";

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(getWorkspaceStateChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const settings = await readAppSettings(app.getPath("userData"));

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "WORKSPACE_STATE_FAILED",
        "ワークスペース情報を読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(openWorkspaceChannel, async (): Promise<RelicResult<WorkspaceState>> => {
    try {
      const selection = await dialog.showOpenDialog({
        buttonLabel: "開く",
        message: "Relicで使うワークスペースフォルダを選んでください。",
        properties: ["openDirectory", "createDirectory"]
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        const settings = await readAppSettings(app.getPath("userData"));

        return ok(await buildWorkspaceState(settings));
      }

      const workspace = createWorkspaceSummary(selection.filePaths[0]);
      await prepareWorkspace(workspace.path);

      const settings = await readAppSettings(app.getPath("userData"));
      const nextSettings = addOrActivateWorkspace(settings, workspace);
      await writeAppSettings(app.getPath("userData"), nextSettings);

      return ok(await buildWorkspaceState(nextSettings));
    } catch (error) {
      return fail(
        "WORKSPACE_OPEN_FAILED",
        "ワークスペースを開けませんでした。フォルダの権限や保存場所を確認してください。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    createMarkdownFileChannel,
    async (_event, input: CreateMarkdownFileInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isCreateMarkdownFileInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "ファイル名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const createdFile = await createMarkdownFile(state.activeWorkspace.path, input.name);

        if (!createdFile.ok) {
          return createdFile;
        }

        return ok(await buildWorkspaceState(settings));
      } catch (error) {
        return fail(
          "FILE_CREATE_FAILED",
          "ファイルを作成できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    createFolderChannel,
    async (_event, input: CreateFolderInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isNameInput(input)) {
          return fail("FOLDER_CREATE_INVALID_INPUT", "フォルダ名を入力してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const createdFolder = await createFolder(state.activeWorkspace.path, input.name);

        if (!createdFolder.ok) {
          return createdFolder;
        }

        return ok(await buildWorkspaceState(settings));
      } catch (error) {
        return fail(
          "FOLDER_CREATE_FAILED",
          "フォルダを作成できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(readMarkdownFileChannel, async (_event, input: ReadMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_READ_INVALID_INPUT", "ファイルパスを指定してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      return readMarkdownFile(state.activeWorkspace.path, input.path);
    } catch (error) {
      return fail(
        "FILE_READ_FAILED",
        "ファイルを読み込めませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });
}

async function buildWorkspaceState(
  settings: Awaited<ReturnType<typeof readAppSettings>>
): Promise<WorkspaceState> {
  const state = toWorkspaceState(settings);

  if (!state.activeWorkspace) {
    return state;
  }

  return toWorkspaceState(settings, await readWorkspaceFileTree(state.activeWorkspace.path));
}

function isCreateMarkdownFileInput(input: unknown): input is CreateMarkdownFileInput {
  return isNameInput(input);
}

function isNameInput(input: unknown): input is { name: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "name" in input &&
    typeof (input as { name?: unknown }).name === "string"
  );
}

function isPathInput(input: unknown): input is { path: string } {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    typeof (input as { path?: unknown }).path === "string"
  );
}
