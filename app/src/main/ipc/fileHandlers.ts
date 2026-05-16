import { ipcMain, shell } from "electron";

import {
  applySearchAndReplaceChannel,
  createFolderChannel,
  type CreateFolderInput,
  createLinkedMarkdownFileChannel,
  type CreateLinkedMarkdownFileInput,
  createMarkdownFileChannel,
  type CreateMarkdownFileInput,
  duplicateMarkdownFileChannel,
  type DuplicateMarkdownFileInput,
  getBacklinksChannel,
  type GetBacklinksInput,
  moveFolderChannel,
  type MoveFolderInput,
  moveItemToTrashChannel,
  type MoveItemToTrashInput,
  moveMarkdownFileChannel,
  type MoveMarkdownFileInput,
  readMarkdownFileChannel,
  type ReadMarkdownFileInput,
  renameFolderChannel,
  type RenameFolderInput,
  renameMarkdownFileChannel,
  type RenameMarkdownFileInput,
  replaceInFileChannel,
  type ReplaceInFileInput,
  revealWorkspaceItemChannel,
  type RevealWorkspaceItemInput,
  searchAndReplaceChannel,
  type SearchAndReplaceInput,
  searchWorkspaceChannel,
  type SearchWorkspaceInput,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readBacklinks } from "../files/backlinks";
import { createFolder, moveFolder, renameFolder } from "../files/folders";
import {
  createMarkdownFileAtPath,
  createMarkdownFile,
  duplicateMarkdownFile,
  moveMarkdownFile,
  readMarkdownFile,
  renameMarkdownFile
} from "../files/markdownFiles";
import { applySearchAndReplace, replaceInFile, searchAndReplace } from "../files/replace";
import { searchWorkspace } from "../files/search";
import { moveWorkspaceItemToTrash } from "../files/trash";
import { resolveWorkspaceRelativePath } from "../files/paths";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import { buildWorkspaceState } from "./workspaceHandlers";

export function registerFileHandlers(): void {
  ipcMain.handle(searchWorkspaceChannel, async (_event, input: SearchWorkspaceInput) => {
    try {
      if (!isSearchWorkspaceInput(input)) {
        return fail("SEARCH_INVALID_INPUT", "検索語句を入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return searchWorkspace(context.value.activeWorkspace.path, input.query, input.mode, input.frontmatterField);
    } catch (error) {
      return fail(
        "SEARCH_FAILED",
        "検索できませんでした。",
        ipcErrorDetails(error)
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
          "ファイルを作成できませんでした。",
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
          return fail("FILE_CREATE_INVALID_INPUT", "作成するファイルを指定してください。");
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
          "ファイルを作成できませんでした。",
          ipcErrorDetails(error)
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

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const createdFolder = await createFolder(context.value.activeWorkspace.path, input.name, input.parentFolder);

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

  ipcMain.handle(readMarkdownFileChannel, async (_event, input: ReadMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_READ_INVALID_INPUT", "ファイルパスを指定してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return readMarkdownFile(context.value.activeWorkspace.path, input.path);
    } catch (error) {
      return fail(
        "FILE_READ_FAILED",
        "ファイルを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(getBacklinksChannel, async (_event, input: GetBacklinksInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("BACKLINKS_INVALID_INPUT", "バックリンクを確認するファイルを指定してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return readBacklinks(context.value.activeWorkspace.path, input.path);
    } catch (error) {
      return fail(
        "BACKLINKS_READ_FAILED",
        "バックリンクを読み込めませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(duplicateMarkdownFileChannel, async (_event, input: DuplicateMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_DUPLICATE_INVALID_INPUT", "複製するファイルを選択してください。");
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
        "ファイルを複製できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(renameMarkdownFileChannel, async (_event, input: RenameMarkdownFileInput) => {
    try {
      if (!isRenameMarkdownFileInput(input)) {
        return fail("FILE_RENAME_INVALID_INPUT", "変更後のファイル名を入力してください。");
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
        "ファイル名を変更できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(moveMarkdownFileChannel, async (_event, input: MoveMarkdownFileInput) => {
    try {
      if (!isMoveMarkdownFileInput(input)) {
        return fail("FILE_MOVE_INVALID_INPUT", "移動先フォルダを指定してください。");
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
        "ファイルを移動できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(moveFolderChannel, async (_event, input: MoveFolderInput) => {
    try {
      if (!isMoveFolderInput(input)) {
        return fail("FOLDER_MOVE_INVALID_INPUT", "移動先フォルダを指定してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const movedFolder = await moveFolder(
        context.value.activeWorkspace.path,
        input.path,
        input.destinationFolder
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

  ipcMain.handle(replaceInFileChannel, async (_event, input: ReplaceInFileInput) => {
    try {
      if (!isReplaceInFileInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return replaceInFile(
        context.value.activeWorkspace.path,
        input.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "置換できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(searchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return searchAndReplace(
        context.value.activeWorkspace.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "置換プレビューを生成できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(applySearchAndReplaceChannel, async (_event, input: SearchAndReplaceInput) => {
    try {
      if (!isSearchAndReplaceInput(input)) {
        return fail("REPLACE_INVALID_INPUT", "検索語句と置換後テキストを入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return applySearchAndReplace(
        context.value.activeWorkspace.path,
        input.searchQuery,
        input.replacement,
        input.isRegex
      );
    } catch (error) {
      return fail(
        "REPLACE_FAILED",
        "一括置換できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  ipcMain.handle(renameFolderChannel, async (_event, input: RenameFolderInput) => {
    try {
      if (!isRenameFolderInput(input)) {
        return fail("FOLDER_RENAME_INVALID_INPUT", "変更後のフォルダ名を入力してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const renamedFolder = await renameFolder(context.value.activeWorkspace.path, input.path, input.newName);

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

  ipcMain.handle(
    moveItemToTrashChannel,
    async (_event, input: MoveItemToTrashInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isMoveItemToTrashInput(input)) {
          return fail("TRASH_MOVE_INVALID_INPUT", "ゴミ箱に移動する項目を選択してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const movedItem = await moveWorkspaceItemToTrash(
          context.value.activeWorkspace.path,
          input.path,
          input.type,
          shell.trashItem
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
          "ファイルの場所を表示できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

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

function isMoveMarkdownFileInput(input: unknown): input is MoveMarkdownFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationFolder?: unknown }).destinationFolder === "string"
  );
}

function isMoveFolderInput(input: unknown): input is MoveFolderInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "destinationFolder" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { destinationFolder?: unknown }).destinationFolder === "string"
  );
}

function isReplaceInFileInput(input: unknown): input is ReplaceInFileInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "path" in input &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof (input as { path?: unknown }).path === "string" &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

function isSearchAndReplaceInput(input: unknown): input is SearchAndReplaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "searchQuery" in input &&
    "replacement" in input &&
    "isRegex" in input &&
    typeof (input as { searchQuery?: unknown }).searchQuery === "string" &&
    typeof (input as { replacement?: unknown }).replacement === "string" &&
    typeof (input as { isRegex?: unknown }).isRegex === "boolean"
  );
}

function isSearchWorkspaceInput(input: unknown): input is SearchWorkspaceInput {
  return (
    typeof input === "object" &&
    input !== null &&
    "query" in input &&
    "mode" in input &&
    typeof (input as { query?: unknown }).query === "string" &&
    (!("frontmatterField" in input) || typeof (input as { frontmatterField?: unknown }).frontmatterField === "string") &&
    ((input as { mode?: unknown }).mode === "fullText" ||
      (input as { mode?: unknown }).mode === "fileName" ||
      (input as { mode?: unknown }).mode === "tag" ||
      (input as { mode?: unknown }).mode === "regex" ||
      (input as { mode?: unknown }).mode === "frontmatter")
  );
}
