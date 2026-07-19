import { readFile, rename } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, type RelicResult } from "../../shared/result";
import { atomicWriteNewTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { updateLinksForFileRename } from "./linkUpdater";
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
import { getRenameDestinationCollision, renameFileSystemEntry } from "./renameOperations";
import { readMarkdownFile } from "./markdownFileContent";

export async function renameMarkdownFile(
  workspacePath: string,
  relativePath: string,
  newName: string,
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<MarkdownFileContent>> {
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
    relativePath,
    sourcePath: absoluteSourcePath.value
  });
}

export async function moveMarkdownFile(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string,
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<MarkdownFileContent>> {
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
    relativePath: string;
    sourcePath: string;
  }
): Promise<RelicResult<MarkdownFileContent>> {
  const absoluteDestinationPath = await resolveNewWorkspacePath(
    workspacePath,
    options.nextRelativePath,
    options.operations
  );

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (options.sourcePath === absoluteDestinationPath.value) {
    return readMarkdownFile(workspacePath, options.relativePath);
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

    await renameFileSystemEntry(
      options.sourcePath,
      absoluteDestinationPath.value,
      collision,
      path.basename(options.sourcePath)
    );
    const links = await updateLinksForFileRename(workspacePath, options.relativePath, options.nextRelativePath);
    if (!links.ok) {
      await rename(absoluteDestinationPath.value, options.sourcePath).catch(() => undefined);
      return links;
    }

    return readMarkdownFile(workspacePath, options.nextRelativePath);
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
