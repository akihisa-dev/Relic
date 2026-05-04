import { app, dialog, ipcMain, shell } from "electron";

import {
  createFolderChannel,
  type CreateFolderInput,
  createLinkedMarkdownFileChannel,
  type CreateLinkedMarkdownFileInput,
  createMarkdownFileChannel,
  type CreateMarkdownFileInput,
  duplicateMarkdownFileChannel,
  type DuplicateMarkdownFileInput,
  getWorkspaceStateChannel,
  moveItemToTrashChannel,
  type MoveItemToTrashInput,
  openWorkspaceChannel,
  readMarkdownFileChannel,
  type ReadMarkdownFileInput,
  renameFolderChannel,
  type RenameFolderInput,
  renameMarkdownFileChannel,
  type RenameMarkdownFileInput,
  switchWorkspaceChannel,
  type SwitchWorkspaceInput,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "../files/fileTree";
import { createFolder, renameFolder } from "../files/folders";
import {
  createMarkdownFileAtPath,
  createMarkdownFile,
  duplicateMarkdownFile,
  readMarkdownFile,
  renameMarkdownFile
} from "../files/markdownFiles";
import { moveWorkspaceItemToTrash } from "../files/trash";
import { readAppSettings, writeAppSettings } from "../settings/appSettings";
import {
  addOrActivateWorkspace,
  activateWorkspace,
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
    createLinkedMarkdownFileChannel,
    async (_event, input: CreateLinkedMarkdownFileInput) => {
      try {
        if (!isPathInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "作成するファイルを指定してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const createdFile = await createMarkdownFileAtPath(state.activeWorkspace.path, input.path);

        if (!createdFile.ok) {
          return createdFile;
        }

        return ok({
          file: createdFile.value,
          workspaceState: await buildWorkspaceState(settings)
        });
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

  ipcMain.handle(duplicateMarkdownFileChannel, async (_event, input: DuplicateMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_DUPLICATE_INVALID_INPUT", "複製するファイルを選択してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const duplicatedFile = await duplicateMarkdownFile(state.activeWorkspace.path, input.path);

      if (!duplicatedFile.ok) {
        return duplicatedFile;
      }

      return ok({
        file: duplicatedFile.value,
        workspaceState: await buildWorkspaceState(settings)
      });
    } catch (error) {
      return fail(
        "FILE_DUPLICATE_FAILED",
        "ファイルを複製できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(renameMarkdownFileChannel, async (_event, input: RenameMarkdownFileInput) => {
    try {
      if (!isRenameMarkdownFileInput(input)) {
        return fail("FILE_RENAME_INVALID_INPUT", "変更後のファイル名を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const renamedFile = await renameMarkdownFile(
        state.activeWorkspace.path,
        input.path,
        input.newName
      );

      if (!renamedFile.ok) {
        return renamedFile;
      }

      return ok({
        file: renamedFile.value,
        workspaceState: await buildWorkspaceState(settings)
      });
    } catch (error) {
      return fail(
        "FILE_RENAME_FAILED",
        "ファイル名を変更できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(renameFolderChannel, async (_event, input: RenameFolderInput) => {
    try {
      if (!isRenameFolderInput(input)) {
        return fail("FOLDER_RENAME_INVALID_INPUT", "変更後のフォルダ名を入力してください。");
      }

      const settings = await readAppSettings(app.getPath("userData"));
      const state = toWorkspaceState(settings);

      if (!state.activeWorkspace) {
        return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
      }

      const renamedFolder = await renameFolder(state.activeWorkspace.path, input.path, input.newName);

      if (!renamedFolder.ok) {
        return renamedFolder;
      }

      return ok(await buildWorkspaceState(settings));
    } catch (error) {
      return fail(
        "FOLDER_RENAME_FAILED",
        "フォルダ名を変更できませんでした。",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  ipcMain.handle(
    moveItemToTrashChannel,
    async (_event, input: MoveItemToTrashInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isMoveItemToTrashInput(input)) {
          return fail("TRASH_MOVE_INVALID_INPUT", "ゴミ箱に移動する項目を選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const state = toWorkspaceState(settings);

        if (!state.activeWorkspace) {
          return fail("WORKSPACE_NOT_SELECTED", "先にワークスペースを開いてください。");
        }

        const movedItem = await moveWorkspaceItemToTrash(
          state.activeWorkspace.path,
          input.path,
          input.type,
          shell.trashItem
        );

        if (!movedItem.ok) {
          return movedItem;
        }

        return ok(await buildWorkspaceState(settings));
      } catch (error) {
        return fail(
          "TRASH_MOVE_FAILED",
          "ゴミ箱に移動できませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );

  ipcMain.handle(
    switchWorkspaceChannel,
    async (_event, input: SwitchWorkspaceInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isSwitchWorkspaceInput(input)) {
          return fail("WORKSPACE_SWITCH_INVALID_INPUT", "ワークスペースを選択してください。");
        }

        const settings = await readAppSettings(app.getPath("userData"));
        const nextSettings = activateWorkspace(settings, input.workspaceId);

        if (!nextSettings.ok) {
          return nextSettings;
        }

        const activeWorkspace = nextSettings.value.workspaces.find(
          (workspace) => workspace.id === input.workspaceId
        );

        if (!activeWorkspace) {
          return fail("WORKSPACE_NOT_FOUND", "登録済みワークスペースが見つかりませんでした。");
        }

        await prepareWorkspace(activeWorkspace.path);
        await writeAppSettings(app.getPath("userData"), nextSettings.value);

        return ok(await buildWorkspaceState(nextSettings.value));
      } catch (error) {
        return fail(
          "WORKSPACE_SWITCH_FAILED",
          "ワークスペースを切り替えられませんでした。",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  );
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

function isRenameMarkdownFileInput(input: unknown): input is RenameMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

function isRenameFolderInput(input: unknown): input is RenameFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "newName" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { newName?: unknown }).newName === "string"
  );
}

function isSwitchWorkspaceInput(input: unknown): input is SwitchWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "workspaceId" in input &&
    typeof (input as { workspaceId?: unknown }).workspaceId === "string"
  );
}

function isMoveItemToTrashInput(input: unknown): input is MoveItemToTrashInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "type" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    ((input as { type?: unknown }).type === "file" || (input as { type?: unknown }).type === "folder")
  );
}
