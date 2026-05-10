import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { updateLinksForFolderRename } from "./linkUpdater";
import { validateBaseName } from "./names";
import { resolveWorkspaceRelativePath } from "./paths";

export interface CreatedFolder {
  path: string;
}

export async function createFolder(
  workspacePath: string,
  name: string,
  parentFolder = ""
): Promise<RelicResult<CreatedFolder>> {
  const validatedName = validateBaseName(name, "フォルダ名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const normalizedParentFolder = toWorkspaceRelativePath(parentFolder.trim());
  const nextRelativePath = toWorkspaceRelativePath(
    normalizedParentFolder === "" ? validatedName.value : `${normalizedParentFolder}/${validatedName.value}`
  );
  const parentPath =
    normalizedParentFolder === "" ? ok(workspacePath) : resolveWorkspaceRelativePath(workspacePath, normalizedParentFolder);

  if (!parentPath.ok) {
    return parentPath;
  }

  try {
    await mkdir(path.join(parentPath.value, validatedName.value));

    return ok({
      path: nextRelativePath
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("FOLDER_ALREADY_EXISTS", "同じ名前のフォルダまたはファイルがすでにあります。");
    }

    return fail(
      "FOLDER_CREATE_FAILED",
      "フォルダを作成できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function renameFolder(
  workspacePath: string,
  relativePath: string,
  newName: string
): Promise<RelicResult<{ path: string }>> {
  const sourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  const validatedName = validateBaseName(newName, "フォルダ名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const nextRelativePath = toWorkspaceRelativePath(path.join(path.dirname(relativePath), validatedName.value));
  const destinationPath = resolveWorkspaceRelativePath(workspacePath, nextRelativePath);

  if (!destinationPath.ok) {
    return destinationPath;
  }

  if (sourcePath.value === destinationPath.value) {
    return ok({ path: relativePath });
  }

  if (await pathExists(destinationPath.value)) {
    return fail("FOLDER_ALREADY_EXISTS", "同じ名前のフォルダまたはファイルがすでにあります。");
  }

  try {
    const sourceStats = await stat(sourcePath.value);

    if (!sourceStats.isDirectory()) {
      return fail("FOLDER_RENAME_NOT_DIRECTORY", "フォルダだけをリネームできます。");
    }

    await rename(sourcePath.value, destinationPath.value);
    await updateLinksForFolderRename(workspacePath, relativePath, nextRelativePath);

    return ok({
      path: nextRelativePath
    });
  } catch (error) {
    return fail(
      "FOLDER_RENAME_FAILED",
      "フォルダ名を変更できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function moveFolder(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string
): Promise<RelicResult<{ path: string }>> {
  const sourcePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  const normalizedDestFolder = toWorkspaceRelativePath(destinationFolder.trim());
  const folderName = path.basename(relativePath);
  const nextRelativePath = toWorkspaceRelativePath(
    normalizedDestFolder === "" ? folderName : `${normalizedDestFolder}/${folderName}`
  );

  if (nextRelativePath === relativePath) {
    return ok({ path: relativePath });
  }

  const destinationPath = resolveWorkspaceRelativePath(workspacePath, nextRelativePath);

  if (!destinationPath.ok) {
    return destinationPath;
  }

  if (await pathExists(destinationPath.value)) {
    return fail("FOLDER_ALREADY_EXISTS", "移動先に同じ名前のフォルダまたはファイルがすでにあります。");
  }

  try {
    const sourceStats = await stat(sourcePath.value);

    if (!sourceStats.isDirectory()) {
      return fail("FOLDER_MOVE_NOT_DIRECTORY", "フォルダだけを移動できます。");
    }

    await rename(sourcePath.value, destinationPath.value);
    await updateLinksForFolderRename(workspacePath, relativePath, nextRelativePath);

    return ok({ path: nextRelativePath });
  } catch (error) {
    return fail(
      "FOLDER_MOVE_FAILED",
      "フォルダを移動できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EEXIST"
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    return !isMissingFileError(error);
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function toWorkspaceRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
