import {
  createLinkedMarkdownFileChannel,
  type CreateLinkedMarkdownFileInput,
  createMarkdownFileChannel,
  type CreateMarkdownFileInput,
  duplicateMarkdownFileChannel,
  type DuplicateMarkdownFileInput,
  getLinkUpdateImpactChannel,
  importMarkdownFilesChannel,
  type ImportMarkdownFilesInput,
  type LinkUpdateImpactInput,
  moveMarkdownFileChannel,
  type MoveMarkdownFileInput,
  renameMarkdownFileChannel,
  type RenameMarkdownFileInput,
  type WorkspaceState
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import {
  createMarkdownFileAtPath,
  createMarkdownFile,
  duplicateMarkdownFile,
  importMarkdownFiles,
  moveMarkdownFile,
  renameMarkdownFile
} from "../files/markdownFiles";
import { readLinkUpdateImpact } from "../files/linkUpdater";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { getCachedMainTranslator } from "../i18n";
import { createCopyNameFormatter } from "../files/markdownFilePaths";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import {
  isCreateMarkdownFileInput,
  isImportMarkdownFilesInput,
  isLinkUpdateImpactInput,
  isMoveMarkdownFileInput,
  isPathInput,
  isRenameMarkdownFileInput
} from "./fileHandlerValidators";
import { buildWorkspaceState } from "./workspaceState";
import { registerAttachmentFileHandlers } from "./attachmentFileHandlers";
import { registerWorkspaceItemHandlers } from "./workspaceItemHandlers";

export function registerMarkdownFileHandlers(): void {
  registerAttachmentFileHandlers();
  registerWorkspaceItemHandlers();

  handleLocalizedIpc(getLinkUpdateImpactChannel, async (_event, input: LinkUpdateImpactInput) => {
    try {
      if (!isLinkUpdateImpactInput(input)) {
        return fail("LINK_UPDATE_IMPACT_INVALID_INPUT", "リンク更新の確認対象が正しくありません。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      return readLinkUpdateImpact(
        context.value.activeWorkspace.path,
        input.kind,
        input.oldPath,
        input.newPath
      );
    } catch (error) {
      return fail(
        "LINK_UPDATE_IMPACT_FAILED",
        "リンク更新の影響件数を確認できませんでした。",
        ipcErrorDetails(error)
      );
    }
  });

  handleLocalizedIpc(
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

        invalidateWorkspaceData(context.value.activeWorkspace.id);
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

  handleLocalizedIpc(
    importMarkdownFilesChannel,
    async (_event, input: ImportMarkdownFilesInput): Promise<RelicResult<WorkspaceState>> => {
      try {
        if (!isImportMarkdownFilesInput(input)) {
          return fail("FILE_IMPORT_INVALID_INPUT", "追加するMarkdownファイルを指定してください。");
        }

        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const importedFiles = await importMarkdownFiles(
          context.value.activeWorkspace.path,
          input.sourcePaths,
          input.destinationFolder
        );

        if (!importedFiles.ok) {
          return importedFiles;
        }

        invalidateWorkspaceData(context.value.activeWorkspace.id);
        return ok(await buildWorkspaceState(context.value.settings));
      } catch (error) {
        return fail(
          "FILE_IMPORT_FAILED",
          "ファイルを追加できませんでした。",
          ipcErrorDetails(error)
        );
      }
    }
  );

  handleLocalizedIpc(
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

        invalidateWorkspaceData(context.value.activeWorkspace.id);
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

  handleLocalizedIpc(duplicateMarkdownFileChannel, async (_event, input: DuplicateMarkdownFileInput) => {
    try {
      if (!isPathInput(input)) {
        return fail("FILE_DUPLICATE_INVALID_INPUT", "複製するファイルを選択してください。");
      }

      const context = await getActiveWorkspaceContext();
      if (!context.ok) return context;

      const t = getCachedMainTranslator();
      const duplicatedFile = await duplicateMarkdownFile(
        context.value.activeWorkspace.path,
        input.path,
        {},
        createCopyNameFormatter(t)
      );

      if (!duplicatedFile.ok) {
        return duplicatedFile;
      }

      invalidateWorkspaceData(context.value.activeWorkspace.id);
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

  handleLocalizedIpc(renameMarkdownFileChannel, async (_event, input: RenameMarkdownFileInput) => {
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

      invalidateWorkspaceData(context.value.activeWorkspace.id);
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

  handleLocalizedIpc(moveMarkdownFileChannel, async (_event, input: MoveMarkdownFileInput) => {
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

      invalidateWorkspaceData(context.value.activeWorkspace.id);
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

}
