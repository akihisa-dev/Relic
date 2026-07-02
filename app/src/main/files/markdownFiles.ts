import { constants } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteNewTextFile, atomicWriteTextFile } from "./atomicWrite";
import { errorDetails, isFileExistsError } from "./fileSystem";
import { updateLinksForFileRename } from "./linkUpdater";
import {
  createCopyRelativePath,
  markdownPathInFolder,
  normalizeMarkdownFileName,
  renamedMarkdownPath
} from "./markdownFilePaths";
import {
  type RealpathOperations,
  resolveExistingWorkspacePath,
  resolveNewWorkspacePath,
  toWorkspaceRelativePath,
  verifyExistingWorkspacePath,
  verifyNewWorkspacePath
} from "./paths";
import {
  getRenameDestinationCollision,
  renameFileSystemEntry
} from "./renameOperations";

export interface CreatedMarkdownFile {
  path: string;
}

export { normalizeMarkdownFileName } from "./markdownFilePaths";

export async function createMarkdownFile(
  workspacePath: string,
  name: string,
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<CreatedMarkdownFile>> {
  const normalizedName = normalizeMarkdownFileName(name);

  if (!normalizedName.ok) {
    return normalizedName;
  }

  const absoluteFilePath = await resolveNewWorkspacePath(workspacePath, normalizedName.value, operations);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    const safeFilePath = await verifyNewWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeFilePath.ok) return safeFilePath;

    await atomicWriteNewTextFile(absoluteFilePath.value, "");

    return ok({
      path: normalizedName.value
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のファイルがすでにあります。別名を入力してください。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "ファイルを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function createMarkdownFileAtPath(
  workspacePath: string,
  relativePath: string,
  content = "",
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<MarkdownFileContent>> {
  const normalizedRelativePath = toWorkspaceRelativePath(relativePath.replace(/\\/g, "/"));

  if (!hasMarkdownExtension(normalizedRelativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを作成できます。");
  }

  const normalizedName = normalizeMarkdownFileName(path.basename(normalizedRelativePath));

  if (!normalizedName.ok) {
    return normalizedName;
  }

  if (normalizedName.value !== path.basename(normalizedRelativePath)) {
    return fail("FILE_NAME_INVALID", "Markdownファイル名を指定してください。");
  }

  const absoluteFilePath = await resolveNewWorkspacePath(workspacePath, normalizedRelativePath, operations);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    const safeParentBeforeMkdir = await verifyNewWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeParentBeforeMkdir.ok) return safeParentBeforeMkdir;

    await mkdir(path.dirname(absoluteFilePath.value), { recursive: true });
    const safeFilePath = await verifyNewWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeFilePath.ok) return safeFilePath;

    await atomicWriteNewTextFile(absoluteFilePath.value, content);

    return readMarkdownFile(workspacePath, normalizedRelativePath);
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のファイルがすでにあります。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "ファイルを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function importMarkdownFiles(
  workspacePath: string,
  sourcePaths: string[],
  destinationFolder: string,
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<MarkdownFileContent[]>> {
  const destinationEntries: Array<{
    absolutePath: string;
    relativePath: string;
    sourcePath: string;
  }> = [];
  const destinationPathSet = new Set<string>();
  const importedFiles: MarkdownFileContent[] = [];

  for (const sourcePath of sourcePaths) {
    const sourceBaseName = path.basename(sourcePath);
    if (!hasMarkdownExtension(sourceBaseName)) {
      return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを追加できます。");
    }

    const normalizedName = normalizeMarkdownFileName(sourceBaseName);
    if (!normalizedName.ok) return normalizedName;

    const destinationRelativePath = destinationFolder === ""
      ? normalizedName.value
      : path.posix.join(destinationFolder, normalizedName.value);
    if (destinationPathSet.has(destinationRelativePath)) {
      return fail("FILE_ALREADY_EXISTS", "追加先に同じ名前のファイルがすでにあります。");
    }
    destinationPathSet.add(destinationRelativePath);

    const absoluteDestinationPath = await resolveNewWorkspacePath(
      workspacePath,
      destinationRelativePath,
      operations
    );

    if (!absoluteDestinationPath.ok) {
      return absoluteDestinationPath;
    }

    try {
      const sourceStat = await stat(sourcePath);
      if (!sourceStat.isFile()) {
        return fail("FILE_IMPORT_SOURCE_INVALID", "追加できるMarkdownファイルを指定してください。");
      }

      const safeDestinationPath = await verifyNewWorkspacePath(
        workspacePath,
        absoluteDestinationPath.value,
        operations
      );
      if (!safeDestinationPath.ok) return safeDestinationPath;
    } catch (error) {
      if (isFileExistsError(error)) {
        return fail("FILE_ALREADY_EXISTS", "追加先に同じ名前のファイルがすでにあります。");
      }

      return fail(
        "FILE_IMPORT_FAILED",
        "ファイルを追加できませんでした。",
        errorDetails(error)
      );
    }

    destinationEntries.push({
      absolutePath: absoluteDestinationPath.value,
      relativePath: destinationRelativePath,
      sourcePath
    });
  }

  const copiedPaths: string[] = [];
  for (const entry of destinationEntries) {
    try {
      await copyFile(entry.sourcePath, entry.absolutePath, constants.COPYFILE_EXCL);
      copiedPaths.push(entry.absolutePath);
      const importedFile = await readMarkdownFile(workspacePath, entry.relativePath);
      if (!importedFile.ok) {
        await Promise.all(copiedPaths.map((copiedPath) => unlink(copiedPath).catch(() => undefined)));
        return importedFile;
      }
      importedFiles.push(importedFile.value);
    } catch (error) {
      await Promise.all(copiedPaths.map((copiedPath) => unlink(copiedPath).catch(() => undefined)));
      if (isFileExistsError(error)) {
        return fail("FILE_ALREADY_EXISTS", "追加先に同じ名前のファイルがすでにあります。");
      }

      return fail(
        "FILE_IMPORT_FAILED",
        "ファイルを追加できませんでした。",
        errorDetails(error)
      );
    }
  }

  return ok(importedFiles);
}

export async function readMarkdownFile(
  workspacePath: string,
  relativePath: string,
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<MarkdownFileContent>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを開けます。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    const safeFilePath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeFilePath.ok) return safeFilePath;

    const content = await readFile(absoluteFilePath.value, "utf8");

    return ok({
      content,
      name: stripMarkdownExtension(path.basename(relativePath)),
      path: relativePath
    });
  } catch (error) {
    return fail(
      "FILE_READ_FAILED",
      "ファイルを読み込めませんでした。",
      errorDetails(error)
    );
  }
}

export async function writeMarkdownFileContent(
  workspacePath: string,
  relativePath: string,
  content: string,
  expectedContent?: string,
  operations: Partial<RealpathOperations> = {},
  beforeWrite?: (previousContent: string) => Promise<RelicResult<void>>
): Promise<RelicResult<void>> {
  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  if (!hasMarkdownExtension(absoluteFilePath.value)) {
    return fail("FILE_WRITE_NOT_MARKDOWN", "Markdownファイル以外は書き込めません。");
  }

  try {
    if (expectedContent !== undefined) {
      const safeReadPath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
      if (!safeReadPath.ok) return safeReadPath;

      const currentContent = await readFile(absoluteFilePath.value, "utf8");
      if (currentContent !== expectedContent) {
        return fail("FILE_WRITE_CONFLICT", "ファイルが外部で変更されています。再読み込みしてから保存してください。");
      }
      if (currentContent !== content && beforeWrite) {
        const recovery = await beforeWrite(currentContent);
        if (!recovery.ok) return recovery;
      }
    }

    const safeWritePath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeWritePath.ok) return safeWritePath;

    await atomicWriteTextFile(absoluteFilePath.value, content);

    return ok(undefined);
  } catch (error) {
    return fail(
      "FILE_WRITE_FAILED",
      "ファイルを保存できませんでした。",
      errorDetails(error)
    );
  }
}

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
  operations: Partial<RealpathOperations> = {}
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
    const destinationRelativePath = await createCopyRelativePath(workspacePath, relativePath);
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
