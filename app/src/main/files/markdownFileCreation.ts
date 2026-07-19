import { constants } from "node:fs";
import { copyFile, mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteNewTextFile } from "./atomicWrite";
import { errorDetails, isFileExistsError } from "./fileSystem";
import { normalizeMarkdownFileName } from "./markdownFilePaths";
import {
  type RealpathOperations,
  resolveNewWorkspacePath,
  toWorkspaceRelativePath,
  verifyNewWorkspacePath
} from "./paths";
import { readMarkdownFile } from "./markdownFileContent";

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
