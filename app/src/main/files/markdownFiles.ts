import { mkdir, rename, readFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteNewTextFile, atomicWriteTextFile } from "./atomicWrite";
import { errorDetails, isFileExistsError, pathExists } from "./fileSystem";
import { updateLinksForFileRename } from "./linkUpdater";
import {
  createCopyRelativePath,
  markdownPathInFolder,
  normalizeMarkdownFileName,
  renamedMarkdownPath
} from "./markdownFilePaths";
import {
  resolveExistingWorkspacePath,
  resolveNewWorkspacePath,
  toWorkspaceRelativePath
} from "./paths";

export interface CreatedMarkdownFile {
  path: string;
}

export { normalizeMarkdownFileName } from "./markdownFilePaths";

export async function createMarkdownFile(
  workspacePath: string,
  name: string
): Promise<RelicResult<CreatedMarkdownFile>> {
  const normalizedName = normalizeMarkdownFileName(name);

  if (!normalizedName.ok) {
    return normalizedName;
  }

  const absoluteFilePath = await resolveNewWorkspacePath(workspacePath, normalizedName.value);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
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
  content = ""
): Promise<RelicResult<MarkdownFileContent>> {
  const normalizedRelativePath = toWorkspaceRelativePath(relativePath.replace(/\\/g, "/"));

  if (path.extname(normalizedRelativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを作成できます。");
  }

  const normalizedName = normalizeMarkdownFileName(path.basename(normalizedRelativePath));

  if (!normalizedName.ok) {
    return normalizedName;
  }

  if (normalizedName.value !== path.basename(normalizedRelativePath)) {
    return fail("FILE_NAME_INVALID", "Markdownファイル名を指定してください。");
  }

  const absoluteFilePath = await resolveNewWorkspacePath(workspacePath, normalizedRelativePath);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    await mkdir(path.dirname(absoluteFilePath.value), { recursive: true });
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

export async function readMarkdownFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを開けます。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    const content = await readFile(absoluteFilePath.value, "utf8");

    return ok({
      content,
      name: path.basename(relativePath, ".md"),
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
  expectedContent?: string
): Promise<RelicResult<void>> {
  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  if (path.extname(absoluteFilePath.value) !== ".md") {
    return fail("FILE_WRITE_NOT_MARKDOWN", "Markdownファイル以外は書き込めません。");
  }

  try {
    if (expectedContent !== undefined) {
      const currentContent = await readFile(absoluteFilePath.value, "utf8");
      if (currentContent !== expectedContent) {
        return fail("FILE_WRITE_CONFLICT", "ファイルが外部で変更されています。再読み込みしてから保存してください。");
      }
    }

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
  newName: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけをリネームできます。");
  }

  const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

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
    relativePath,
    sourcePath: absoluteSourcePath.value
  });
}

export async function moveMarkdownFile(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを移動できます。");
  }

  const absoluteSourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = markdownPathInFolder(relativePath, destinationFolder);

  return moveMarkdownFileToPath(workspacePath, {
    alreadyExistsMessage: "移動先に同じ名前のファイルがすでにあります。",
    failureCode: "FILE_MOVE_FAILED",
    failureMessage: "ファイルを移動できませんでした。",
    nextRelativePath,
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
    relativePath: string;
    sourcePath: string;
  }
): Promise<RelicResult<MarkdownFileContent>> {
  const absoluteDestinationPath = await resolveNewWorkspacePath(workspacePath, options.nextRelativePath);

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (options.sourcePath === absoluteDestinationPath.value) {
    return readMarkdownFile(workspacePath, options.relativePath);
  }

  if (await pathExists(absoluteDestinationPath.value)) {
    return fail("FILE_ALREADY_EXISTS", options.alreadyExistsMessage);
  }

  try {
    await rename(options.sourcePath, absoluteDestinationPath.value);
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
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを複製できます。");
  }

  const sourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  try {
    const content = await readFile(sourcePath.value, "utf8");
    const destinationRelativePath = await createCopyRelativePath(workspacePath, relativePath);
    const destinationPath = await resolveNewWorkspacePath(workspacePath, destinationRelativePath);

    if (!destinationPath.ok) {
      return destinationPath;
    }

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
