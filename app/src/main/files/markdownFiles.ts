import { mkdir, rename, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails, isFileExistsError, pathExists } from "./fileSystem";
import { updateLinksForFileRename } from "./linkUpdater";
import {
  createCopyRelativePath,
  markdownPathInFolder,
  normalizeMarkdownFileName,
  renamedMarkdownPath
} from "./markdownFilePaths";
import { resolveWorkspaceRelativePath, toWorkspaceRelativePath } from "./paths";

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

  const absoluteFilePath = path.join(workspacePath, normalizedName.value);

  try {
    await writeFile(absoluteFilePath, "", {
      encoding: "utf8",
      flag: "wx"
    });

    return ok({
      path: normalizedName.value
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のカードがすでにあります。別名を入力してください。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "カードを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function createMarkdownFileAtPath(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  const normalizedRelativePath = toWorkspaceRelativePath(relativePath.replace(/\\/g, "/"));

  if (path.extname(normalizedRelativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを作成できます。");
  }

  const normalizedName = normalizeMarkdownFileName(path.basename(normalizedRelativePath));

  if (!normalizedName.ok) {
    return normalizedName;
  }

  if (normalizedName.value !== path.basename(normalizedRelativePath)) {
    return fail("FILE_NAME_INVALID", "Markdownカード名を指定してください。");
  }

  const absoluteFilePath = resolveWorkspaceRelativePath(workspacePath, normalizedRelativePath);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    await mkdir(path.dirname(absoluteFilePath.value), { recursive: true });
    await writeFile(absoluteFilePath.value, "", {
      encoding: "utf8",
      flag: "wx"
    });

    return readMarkdownFile(workspacePath, normalizedRelativePath);
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FILE_ALREADY_EXISTS", "同じ名前のカードがすでにあります。");
    }

    return fail(
      "FILE_CREATE_FAILED",
      "カードを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function readMarkdownFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを開けます。");
  }

  const absoluteFilePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

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
      "カードを読み込めませんでした。",
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
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけをリネームできます。");
  }

  const absoluteSourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = renamedMarkdownPath(relativePath, newName);

  if (!nextRelativePath.ok) {
    return nextRelativePath;
  }

  const absoluteDestinationPath = resolveWorkspaceRelativePath(workspacePath, nextRelativePath.value);

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (absoluteSourcePath.value === absoluteDestinationPath.value) {
    return readMarkdownFile(workspacePath, relativePath);
  }

  if (await pathExists(absoluteDestinationPath.value)) {
    return fail("FILE_ALREADY_EXISTS", "同じ名前のカードがすでにあります。別名を入力してください。");
  }

  try {
    await rename(absoluteSourcePath.value, absoluteDestinationPath.value);
    await updateLinksForFileRename(workspacePath, relativePath, nextRelativePath.value);

    return readMarkdownFile(workspacePath, nextRelativePath.value);
  } catch (error) {
    return fail(
      "FILE_RENAME_FAILED",
      "カード名を変更できませんでした。",
      errorDetails(error)
    );
  }
}

export async function moveMarkdownFile(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを移動できます。");
  }

  const absoluteSourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!absoluteSourcePath.ok) {
    return absoluteSourcePath;
  }

  const nextRelativePath = markdownPathInFolder(relativePath, destinationFolder);

  if (nextRelativePath === relativePath) {
    return readMarkdownFile(workspacePath, relativePath);
  }

  const absoluteDestinationPath = resolveWorkspaceRelativePath(workspacePath, nextRelativePath);

  if (!absoluteDestinationPath.ok) {
    return absoluteDestinationPath;
  }

  if (await pathExists(absoluteDestinationPath.value)) {
    return fail("FILE_ALREADY_EXISTS", "移動先に同じ名前のカードがすでにあります。");
  }

  try {
    await rename(absoluteSourcePath.value, absoluteDestinationPath.value);
    await updateLinksForFileRename(workspacePath, relativePath, nextRelativePath);

    return readMarkdownFile(workspacePath, nextRelativePath);
  } catch (error) {
    return fail(
      "FILE_MOVE_FAILED",
      "カードを移動できませんでした。",
      errorDetails(error)
    );
  }
}

export async function duplicateMarkdownFile(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<MarkdownFileContent>> {
  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを複製できます。");
  }

  const sourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  try {
    const content = await readFile(sourcePath.value, "utf8");
    const destinationRelativePath = await createCopyRelativePath(workspacePath, relativePath);
    const destinationPath = resolveWorkspaceRelativePath(workspacePath, destinationRelativePath);

    if (!destinationPath.ok) {
      return destinationPath;
    }

    await writeFile(destinationPath.value, content, {
      encoding: "utf8",
      flag: "wx"
    });

    return readMarkdownFile(workspacePath, destinationRelativePath);
  } catch (error) {
    return fail(
      "FILE_DUPLICATE_FAILED",
      "カードを複製できませんでした。",
      errorDetails(error)
    );
  }
}
