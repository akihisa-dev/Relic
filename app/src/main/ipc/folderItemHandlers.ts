import { shell } from "electron";

import {
  createFolderChannel,
  type CreateFolderInput,
  moveFolderChannel,
  type MoveFolderInput,
  moveItemToTrashChannel,
  type MoveItemToTrashInput,
  renameFolderChannel,
  type RenameFolderInput,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createFolder, moveFolder, renameFolder } from "../files/folders";
import { moveWorkspaceItemToTrash } from "../files/trash";
import { workspaceMutationService } from "../files/workspaceMutationService";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import {
  isCreateFolderInput,
  isMoveFolderInput,
  isMoveItemToTrashInput,
  isRenameFolderInput
} from "./fileHandlerValidators";
import { buildWorkspaceState } from "./workspaceState";

export function registerFolderItemHandlers(): void {
  handleLocalizedIpc(
    createFolderChannel,
    async (_event, input: CreateFolderInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isCreateFolderInput(input)) {
          return fail("FOLDER_CREATE_INVALID_INPUT", "フォルダ名を入力してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const createdFolder = await workspaceMutationService.run(
          { workspaceId: context.value.activeWorkspace.id, workspacePath: context.value.activeWorkspace.path },
          ({ workspacePath }) => createFolder(workspacePath, input.name, input.parentFolder)
        );

        if (!createdFolder.ok) {
          return createdFolder;
        }

        return ok(await buildWorkspaceState(context.value.settings));
      } catch (error) {
        return fail(
          "FOLDER_CREATE_FAILED",
          "フォルダを作成できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  handleLocalizedIpc(moveFolderChannel, async (_event, input: MoveFolderInput) => {
    try {
      if (!isMoveFolderInput(input)) {
        return fail("FOLDER_MOVE_INVALID_INPUT", "移動先フォルダを指定してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const movedFolder = await workspaceMutationService.run(
        { workspaceId: context.value.activeWorkspace.id, workspacePath: context.value.activeWorkspace.path },
        ({ workspacePath }) => moveFolder(workspacePath, input.path, input.destinationFolder)
      );

      if (!movedFolder.ok) {
        return movedFolder;
      }

      return ok(await buildWorkspaceState(context.value.settings));
    } catch (error) {
      return fail(
        "FOLDER_MOVE_FAILED",
        "フォルダを移動できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(renameFolderChannel, async (_event, input: RenameFolderInput) => {
    try {
      if (!isRenameFolderInput(input)) {
        return fail("FOLDER_RENAME_INVALID_INPUT", "変更後のフォルダ名を入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const renamedFolder = await workspaceMutationService.run(
        { workspaceId: context.value.activeWorkspace.id, workspacePath: context.value.activeWorkspace.path },
        ({ workspacePath }) => renameFolder(workspacePath, input.path, input.newName)
      );

      if (!renamedFolder.ok) {
        return renamedFolder;
      }

      return ok(await buildWorkspaceState(context.value.settings));
    } catch (error) {
      return fail(
        "FOLDER_RENAME_FAILED",
        "フォルダ名を変更できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(
    moveItemToTrashChannel,
    async (_event, input: MoveItemToTrashInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isMoveItemToTrashInput(input)) {
          return fail("TRASH_MOVE_INVALID_INPUT", "ゴミ箱に移動する項目を選択してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const movedItem = await workspaceMutationService.run(
          { workspaceId: context.value.activeWorkspace.id, workspacePath: context.value.activeWorkspace.path },
          ({ workspacePath }) => moveWorkspaceItemToTrash(workspacePath, input.path, input.type, shell.trashItem)
        );

        if (!movedItem.ok) {
          return movedItem;
        }

        return ok(await buildWorkspaceState(context.value.settings));
      } catch (error) {
        return fail(
          "TRASH_MOVE_FAILED",
          "ゴミ箱に移動できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}
