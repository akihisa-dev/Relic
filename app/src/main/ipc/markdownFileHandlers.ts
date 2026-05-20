import { ipcMain, shell } from "electron";

import {
  createLinkedMarkdownFileChannel,
  type CreateLinkedMarkdownFileInput,
  createMarkdownFileChannel,
  type CreateMarkdownFileInput,
  duplicateMarkdownFileChannel,
  type DuplicateMarkdownFileInput,
  moveMarkdownFileChannel,
  type MoveMarkdownFileInput,
  renameMarkdownFileChannel,
  type RenameMarkdownFileInput,
  revealWorkspaceItemChannel,
  type RevealWorkspaceItemInput,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  createMarkdownFileAtPath,
  createMarkdownFile,
  duplicateMarkdownFile,
  moveMarkdownFile,
  renameMarkdownFile
} from "../files/markdownFiles";
import { resolveWorkspaceRelativePath } from "../files/paths";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import {
  isCreateMarkdownFileInput,
  isMoveMarkdownFileInput,
  isPathInput,
  isRenameMarkdownFileInput
} from "./fileHandlerValidators";
import { buildWorkspaceState } from "./workspaceState";

export function registerMarkdownFileHandlers(): void {
  ipcMain.handle(
    createMarkdownFileChannel,
    async (_event, input: CreateMarkdownFileInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isCreateMarkdownFileInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "カード名を入力してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const createdFile = await createMarkdownFile(context.value.activeWorkspace.path, input.name);

        if (!createdFile.ok) {
          return createdFile;
        }

        return ok(await buildWorkspaceState(context.value.settings));
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
    createLinkedMarkdownFileChannel,
    async (_event, input: CreateLinkedMarkdownFileInput) => {
      try {
        if (!isPathInput(input)) {
          return fail("FILE_CREATE_INVALID_INPUT", "作成するカードを指定してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const createdFile = await createMarkdownFileAtPath(context.value.activeWorkspace.path, input.path);

        if (!createdFile.ok) {
          return createdFile;
        }

        return ok({
          file: createdFile.value,
          workspaceState: await buildWorkspaceState(context.value.settings)
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

  ipcMain.handle(duplicateMarkdownFileChannel, async (_event, input: DuplicateMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_DUPLICATE_INVALID_INPUT", "複製するカードを選択してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const duplicatedFile = await duplicateMarkdownFile(context.value.activeWorkspace.path, input.path);

      if (!duplicatedFile.ok) {
        return duplicatedFile;
      }

      return ok({
        file: duplicatedFile.value,
        workspaceState: await buildWorkspaceState(context.value.settings)
      });
    } catch (error) {
      return fail(
        "FILE_DUPLICATE_FAILED",
        "カードを複製できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(renameMarkdownFileChannel, async (_event, input: RenameMarkdownFileInput) => {
    try {
      if (!isRenameMarkdownFileInput(input)) {
        return fail("FILE_RENAME_INVALID_INPUT", "変更後のカード名を入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const renamedFile = await renameMarkdownFile(
        context.value.activeWorkspace.path,
        input.path,
        input.newName
      );

      if (!renamedFile.ok) {
        return renamedFile;
      }

      return ok({
        file: renamedFile.value,
        workspaceState: await buildWorkspaceState(context.value.settings)
      });
    } catch (error) {
      return fail(
        "FILE_RENAME_FAILED",
        "カード名を変更できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(moveMarkdownFileChannel, async (_event, input: MoveMarkdownFileInput) => {
    try {
      if (!isMoveMarkdownFileInput(input)) {
        return fail("FILE_MOVE_INVALID_INPUT", "移動先カードフォルダを指定してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const movedFile = await moveMarkdownFile(
        context.value.activeWorkspace.path,
        input.path,
        input.destinationFolder
      );

      if (!movedFile.ok) {
        return movedFile;
      }

      return ok({
        file: movedFile.value,
        workspaceState: await buildWorkspaceState(context.value.settings)
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
    revealWorkspaceItemChannel,
    async (_event, input: RevealWorkspaceItemInput): Promise<RelicResult<void>> => {
      try {
        if (!isPathInput(input)) {
          return fail("REVEAL_INVALID_INPUT", "表示する項目を選択してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const absolutePath = resolveWorkspaceRelativePath(context.value.activeWorkspace.path, input.path);

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
