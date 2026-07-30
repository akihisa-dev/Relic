import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent, MarkdownFileRelocationRecovery } from "../../shared/ipc";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteNewTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import {
  prepareLinksForFileRename,
  type PreparedLinkUpdate
} from "./linkUpdater";
import {
  createCopyRelativePath,
  markdownPathInFolder,
  renamedMarkdownPath,
  type CopyNameFormatter
} from "./markdownFilePaths";
import {
  type RealpathOperations,
  resolveExistingWorkspacePath,
  resolveNewWorkspacePath,
  verifyExistingWorkspacePath,
  verifyNewWorkspacePath
} from "./paths";
import {
  getRenameDestinationCollision,
  renameFileSystemEntry,
  rollbackRenamedFileWithoutOverwrite
} from "./renameOperations";
import { readMarkdownFile } from "./markdownFileContent";

export type MarkdownFileRelocationOutcome =
  | {
      file: MarkdownFileContent;
      status: "completed";
    }
  | {
      recovery: MarkdownFileRelocationRecovery;
      status: "recovery-required" | "rolled-back";
    };

interface MarkdownFileRelocationOperations {
  pathExists(filePath: string): Promise<boolean>;
  prepareLinks(
    workspacePath: string,
    oldRelativePath: string,
    newRelativePath: string
  ): Promise<RelicResult<PreparedLinkUpdate>>;
  readFinalFile(workspacePath: string, relativePath: string): Promise<RelicResult<MarkdownFileContent>>;
  rollbackFile(currentPath: string, originalPath: string): Promise<void>;
}

const defaultMarkdownFileRelocationOperations: MarkdownFileRelocationOperations = {
  pathExists: async (filePath) => {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  },
  prepareLinks: prepareLinksForFileRename,
  readFinalFile: readMarkdownFile,
  rollbackFile: rollbackRenamedFileWithoutOverwrite
};

export async function renameMarkdownFile(
  workspacePath: string,
  relativePath: string,
  newName: string,
  operations: Partial<RealpathOperations> = {},
  relocationOperations: Partial<MarkdownFileRelocationOperations> = {}
): Promise<RelicResult<MarkdownFileRelocationOutcome>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけをリネームできます。");
  }

  const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = renamedMarkdownPath(relativePath, newName);

  if (!nextRelativePath.ok) {
    return nextRelativePath;
  }

  return moveMarkdownFileToPath(workspacePath, {
    alreadyExistsMessage: "同じ名前のファイルがすでにあります。別名を入力してください。",
    failureCode: "FILE_RENAME_FAILED",
    failureMessage: "ファイル名を変更できませんでした。",
    nextRelativePath: nextRelativePath.value,
    operations,
    relocationOperations,
    relativePath,
    sourcePath: absoluteSourcePath.value
  });
}

export async function moveMarkdownFile(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string,
  operations: Partial<RealpathOperations> = {},
  relocationOperations: Partial<MarkdownFileRelocationOperations> = {}
): Promise<RelicResult<MarkdownFileRelocationOutcome>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを移動できます。");
  }

  const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = markdownPathInFolder(relativePath, destinationFolder);

  return moveMarkdownFileToPath(workspacePath, {
    alreadyExistsMessage: "移動先に同じ名前のファイルがすでにあります。",
    failureCode: "FILE_MOVE_FAILED",
    failureMessage: "ファイルを移動できませんでした。",
    nextRelativePath,
    operations,
    relocationOperations,
    relativePath,
    sourcePath: absoluteSourcePath.value
  });
}

async function moveMarkdownFileToPath(
  workspacePath: string,
  options: {
    alreadyExistsMessage: string;
    failureCode: "FILE_RENAME_FAILED" | "FILE_MOVE_FAILED";
    failureMessage: string;
    nextRelativePath: string;
    operations: Partial<RealpathOperations>;
    relocationOperations: Partial<MarkdownFileRelocationOperations>;
    relativePath: string;
    sourcePath: string;
  }
): Promise<RelicResult<MarkdownFileRelocationOutcome>> {
  const relocationOperations = {
    ...defaultMarkdownFileRelocationOperations,
    ...options.relocationOperations
  };
  const absoluteDestinationPath = await resolveNewWorkspacePath(
    workspacePath,
    options.nextRelativePath,
    options.operations
  );

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (options.sourcePath === absoluteDestinationPath.value) {
    const file = await readMarkdownFile(workspacePath, options.relativePath);
    return file.ok ? ok({ file: file.value, status: "completed" }) : file;
  }

  const safeSourcePath = await verifyExistingWorkspacePath(workspacePath, options.sourcePath, options.operations);
  if (!safeSourcePath.ok) return safeSourcePath;

  const safeDestinationPath = await verifyNewWorkspacePath(
    workspacePath,
    absoluteDestinationPath.value,
    options.operations
  );
  if (!safeDestinationPath.ok) return safeDestinationPath;

  const collision = await getRenameDestinationCollision(options.sourcePath, absoluteDestinationPath.value);

  if (collision === "different-entry") {
    return fail("FILE_ALREADY_EXISTS", options.alreadyExistsMessage);
  }

  try {
    const safeSourceBeforeRename = await verifyExistingWorkspacePath(workspacePath, options.sourcePath, options.operations);
    if (!safeSourceBeforeRename.ok) return safeSourceBeforeRename;

    const safeDestinationBeforeRename = await verifyNewWorkspacePath(
      workspacePath,
      absoluteDestinationPath.value,
      options.operations
    );
    if (!safeDestinationBeforeRename.ok) return safeDestinationBeforeRename;

    const sourceFile = await readMarkdownFile(workspacePath, options.relativePath);
    if (!sourceFile.ok) return sourceFile;
    const preparedLinks = await relocationOperations.prepareLinks(
      workspacePath,
      options.relativePath,
      options.nextRelativePath
    );
    if (!preparedLinks.ok) return preparedLinks;
    const sourceBeforeRename = await readMarkdownFile(workspacePath, options.relativePath);
    if (!sourceBeforeRename.ok) return sourceBeforeRename;
    if (sourceBeforeRename.value.content !== sourceFile.value.content) {
      return fail(
        "FILE_RELOCATION_CONFLICT",
        "移動または名前変更の対象ファイルが外部で変更されています。再読み込みしてから実行してください。"
      );
    }
    const collisionBeforeRename = await getRenameDestinationCollision(
      options.sourcePath,
      absoluteDestinationPath.value
    );
    if (collisionBeforeRename === "different-entry") {
      return fail("FILE_ALREADY_EXISTS", options.alreadyExistsMessage);
    }

    await renameFileSystemEntry(
      options.sourcePath,
      absoluteDestinationPath.value,
      collisionBeforeRename,
      path.basename(options.sourcePath)
    );
    let links;
    try {
      links = await preparedLinks.value.apply();
    } catch (error) {
      links = {
        error: {
          code: "LINK_UPDATE_WRITE_FAILED",
          details: errorDetails(error),
          message: "内部リンクを更新できませんでした。"
        },
        ok: false as const,
        recovery: {
          appliedPaths: [],
          conflictedPaths: [],
          rolledBackPaths: [],
          rollbackFailedPaths: []
        }
      };
    }
    if (!links.ok) {
      let fileRollback: MarkdownFileRelocationRecovery["fileRollback"] = "succeeded";
      const oldPathOccupied = await relocationOperations.pathExists(options.sourcePath);
      try {
        if (oldPathOccupied) throw new Error("Original path is occupied.");
        await relocationOperations.rollbackFile(absoluteDestinationPath.value, options.sourcePath);
      } catch {
        fileRollback = "failed";
      }

      const oldPathExists = await relocationOperations.pathExists(options.sourcePath);
      const newPathExists = await relocationOperations.pathExists(absoluteDestinationPath.value);
      const currentPath = oldPathExists === newPathExists
        ? null
        : oldPathExists
          ? options.relativePath
          : options.nextRelativePath;
      const hasUnrecoveredLinks =
        links.recovery.conflictedPaths.length > 0 ||
        links.recovery.rollbackFailedPaths.length > 0;
      const status = fileRollback === "succeeded" && !hasUnrecoveredLinks
        ? "rolled-back"
        : "recovery-required";

      return ok({
        recovery: {
          currentPath,
          fileRollback,
          linkUpdates: links.recovery,
          newPath: options.nextRelativePath,
          oldPath: options.relativePath,
          reasonCode: links.error.code
        },
        status
      });
    }

    let finalFile: RelicResult<MarkdownFileContent>;
    try {
      finalFile = await relocationOperations.readFinalFile(workspacePath, options.nextRelativePath);
    } catch (error) {
      finalFile = fail("FILE_READ_FAILED", "ファイルを読み込めませんでした。", errorDetails(error));
    }
    if (finalFile.ok) {
      return ok({ file: finalFile.value, status: "completed" });
    }

    return ok({
      file: {
        ...sourceFile.value,
        name: stripMarkdownExtension(path.posix.basename(options.nextRelativePath)),
        path: options.nextRelativePath
      },
      status: "completed"
    });
  } catch (error) {
    return fail(
      options.failureCode,
      options.failureMessage,
      errorDetails(error)
    );
  }
}

export async function duplicateMarkdownFile(
  workspacePath: string,
  relativePath: string,
  operations: Partial<RealpathOperations> = {},
  formatCopyName?: CopyNameFormatter
): Promise<RelicResult<MarkdownFileContent>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを複製できます。");
  }

  const sourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  try {
    const safeSourcePath = await verifyExistingWorkspacePath(workspacePath, sourcePath.value, operations);
    if (!safeSourcePath.ok) return safeSourcePath;

    const content = await readFile(sourcePath.value, "utf8");
    const destinationRelativePath = await createCopyRelativePath(
      workspacePath,
      relativePath,
      undefined,
      formatCopyName
    );
    const destinationPath = await resolveNewWorkspacePath(workspacePath, destinationRelativePath, operations);

    if (!destinationPath.ok) {
      return destinationPath;
    }

    const safeDestinationPath = await verifyNewWorkspacePath(workspacePath, destinationPath.value, operations);
    if (!safeDestinationPath.ok) return safeDestinationPath;

    await atomicWriteNewTextFile(destinationPath.value, content);

    return readMarkdownFile(workspacePath, destinationRelativePath);
  } catch (error) {
    return fail(
      "FILE_DUPLICATE_FAILED",
      "ファイルを複製できませんでした。",
      errorDetails(error)
    );
  }
}
