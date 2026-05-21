import { ipcMain, shell } from "electron";

import {
  createCardFolderChannel,
  type CreateCardFolderInput,
  moveCardFolderChannel,
  type MoveCardFolderInput,
  moveItemToTrashChannel,
  type MoveItemToTrashInput,
  renameCardFolderChannel,
  type RenameCardFolderInput,
  type CardbookState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createCardFolder, moveCardFolder, renameCardFolder } from "../cards/cardFolders";
import { moveCardbookItemToTrash } from "../cards/trash";
import { getActiveCardbookContext, ipcErrorDetails } from "./activeCardbook";
import {
  isMoveCardFolderInput,
  isMoveItemToTrashInput,
  isNameInput,
  isRenameCardFolderInput
} from "./cardHandlerValidators";
import { buildCardbookState } from "./cardbookState";

export function registerCardFolderItemHandlers(): void {
  ipcMain.handle(
    createCardFolderChannel,
    async (_event, input: CreateCardFolderInput): Promise<RelicResult<CardbookState>> => {
      try {
        if (!isNameInput(input)) {
          return fail("FOLDER_CREATE_INVALID_INPUT", "カードフォルダ名を入力してください。");
        }

        const context = await getActiveCardbookContext();
        if (!context.ok) return context;

        const createdCardFolder = await createCardFolder(context.value.activeCardbook.path, input.name, input.parentCardFolder);

        if (!createdCardFolder.ok) {
          return createdCardFolder;
        }

        return ok(await buildCardbookState(context.value.settings));
      } catch (error) {
        return fail(
          "FOLDER_CREATE_FAILED",
          "カードフォルダを作成できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(moveCardFolderChannel, async (_event, input: MoveCardFolderInput) => {
    try {
      if (!isMoveCardFolderInput(input)) {
        return fail("FOLDER_MOVE_INVALID_INPUT", "移動先カードフォルダを指定してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const movedCardFolder = await moveCardFolder(
        context.value.activeCardbook.path,
        input.path,
        input.destinationCardFolder
      );

      if (!movedCardFolder.ok) {
        return movedCardFolder;
      }

      return ok(await buildCardbookState(context.value.settings));
    } catch (error) {
      return fail(
        "FOLDER_MOVE_FAILED",
        "カードフォルダを移動できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(renameCardFolderChannel, async (_event, input: RenameCardFolderInput) => {
    try {
      if (!isRenameCardFolderInput(input)) {
        return fail("FOLDER_RENAME_INVALID_INPUT", "変更後のカードフォルダ名を入力してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const renamedCardFolder = await renameCardFolder(context.value.activeCardbook.path, input.path, input.newName);

      if (!renamedCardFolder.ok) {
        return renamedCardFolder;
      }

      return ok(await buildCardbookState(context.value.settings));
    } catch (error) {
      return fail(
        "FOLDER_RENAME_FAILED",
        "カードフォルダ名を変更できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(
    moveItemToTrashChannel,
    async (_event, input: MoveItemToTrashInput): Promise<RelicResult<CardbookState>> => {
      try {
        if (!isMoveItemToTrashInput(input)) {
          return fail("TRASH_MOVE_INVALID_INPUT", "ゴミ箱に移動する項目を選択してください。");
        }

        const context = await getActiveCardbookContext();
        if (!context.ok) return context;

        const movedItem = await moveCardbookItemToTrash(
          context.value.activeCardbook.path,
          input.path,
          input.type,
          shell.trashItem
        );

        if (!movedItem.ok) {
          return movedItem;
        }

        return ok(await buildCardbookState(context.value.settings));
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
