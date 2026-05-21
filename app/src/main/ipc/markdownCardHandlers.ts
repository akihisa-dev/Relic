import { ipcMain, shell } from "electron";

import {
  createLinkedMarkdownCardChannel,
  type CreateLinkedMarkdownCardInput,
  createMarkdownCardChannel,
  type CreateMarkdownCardInput,
  duplicateMarkdownCardChannel,
  type DuplicateMarkdownCardInput,
  moveMarkdownCardChannel,
  type MoveMarkdownCardInput,
  renameMarkdownCardChannel,
  type RenameMarkdownCardInput,
  revealCardbookItemChannel,
  type RevealCardbookItemInput,
  type CardbookState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  createMarkdownCardAtPath,
  createMarkdownCard,
  duplicateMarkdownCard,
  moveMarkdownCard,
  renameMarkdownCard
} from "../cards/markdownCards";
import { resolveCardbookRelativePath } from "../cards/paths";
import { getActiveCardbookContext, ipcErrorDetails } from "./activeCardbook";
import {
  isCreateMarkdownCardInput,
  isMoveMarkdownCardInput,
  isPathInput,
  isRenameMarkdownCardInput
} from "./cardHandlerValidators";
import { buildCardbookState } from "./cardbookState";

export function registerMarkdownCardHandlers(): void {
  ipcMain.handle(
    createMarkdownCardChannel,
    async (_event, input: CreateMarkdownCardInput): Promise<RelicResult<CardbookState>> => {
      try {
        if (!isCreateMarkdownCardInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "カード名を入力してください。");
        }

        const context = await getActiveCardbookContext();
        if (!context.ok) return context;

        const createdCard = await createMarkdownCard(context.value.activeCardbook.path, input.name);

        if (!createdCard.ok) {
          return createdCard;
        }

        return ok(await buildCardbookState(context.value.settings));
      } catch (error) {
        return fail(
          "FILE_CREATE_FAILED",
          "カードを作成できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(
    createLinkedMarkdownCardChannel,
    async (_event, input: CreateLinkedMarkdownCardInput) => {
      try {
        if (!isPathInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "作成するカードを指定してください。");
        }

        const context = await getActiveCardbookContext();
        if (!context.ok) return context;

        const createdCard = await createMarkdownCardAtPath(context.value.activeCardbook.path, input.path);

        if (!createdCard.ok) {
          return createdCard;
        }

        return ok({
          card: createdCard.value,
          cardbookState: await buildCardbookState(context.value.settings)
        });
      } catch (error) {
        return fail(
          "FILE_CREATE_FAILED",
          "カードを作成できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  ipcMain.handle(duplicateMarkdownCardChannel, async (_event, input: DuplicateMarkdownCardInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_DUPLICATE_INVALID_INPUT", "複製するカードを選択してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const duplicatedCard = await duplicateMarkdownCard(context.value.activeCardbook.path, input.path);

      if (!duplicatedCard.ok) {
        return duplicatedCard;
      }

      return ok({
        card: duplicatedCard.value,
        cardbookState: await buildCardbookState(context.value.settings)
      });
    } catch (error) {
      return fail(
        "FILE_DUPLICATE_FAILED",
        "カードを複製できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(renameMarkdownCardChannel, async (_event, input: RenameMarkdownCardInput) => {
    try {
      if (!isRenameMarkdownCardInput(input)) {
        return fail("FILE_RENAME_INVALID_INPUT", "変更後のカード名を入力してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const renamedCard = await renameMarkdownCard(
        context.value.activeCardbook.path,
        input.path,
        input.newName
      );

      if (!renamedCard.ok) {
        return renamedCard;
      }

      return ok({
        card: renamedCard.value,
        cardbookState: await buildCardbookState(context.value.settings)
      });
    } catch (error) {
      return fail(
        "FILE_RENAME_FAILED",
        "カード名を変更できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(moveMarkdownCardChannel, async (_event, input: MoveMarkdownCardInput) => {
    try {
      if (!isMoveMarkdownCardInput(input)) {
        return fail("FILE_MOVE_INVALID_INPUT", "移動先カードフォルダを指定してください。");
      }

      const context = await getActiveCardbookContext();
      if (!context.ok) return context;

      const movedCard = await moveMarkdownCard(
        context.value.activeCardbook.path,
        input.path,
        input.destinationCardFolder
      );

      if (!movedCard.ok) {
        return movedCard;
      }

      return ok({
        card: movedCard.value,
        cardbookState: await buildCardbookState(context.value.settings)
      });
    } catch (error) {
      return fail(
        "FILE_MOVE_FAILED",
        "カードを移動できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(
    revealCardbookItemChannel,
    async (_event, input: RevealCardbookItemInput): Promise<RelicResult<void>> => {
      try {
        if (!isPathInput(input)) {
          return fail("REVEAL_INVALID_INPUT", "表示する項目を選択してください。");
        }

        const context = await getActiveCardbookContext();
        if (!context.ok) return context;

        const absolutePath = resolveCardbookRelativePath(context.value.activeCardbook.path, input.path);

        if (!absolutePath.ok) {
          return absolutePath;
        }

        shell.showItemInFolder(absolutePath.value);
        return ok(undefined);
      } catch (error) {
        return fail(
          "REVEAL_FAILED",
          "カードの場所を表示できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );
}
