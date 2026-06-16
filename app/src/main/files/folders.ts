import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails, isFileExistsError, pathExists } from "./fileSystem";
import { updateLinksForFolderRename } from "./linkUpdater";
import { validateBaseName } from "./names";
import {
  resolveExistingWorkspacePath,
  resolveExistingWorkspacePathOrRoot,
  resolveNewWorkspacePath,
  toWorkspaceRelativePath
} from "./paths";

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
    normalizedParentFolder === ""
      ? await resolveExistingWorkspacePathOrRoot(workspacePath, "")
      : await resolveExistingWorkspacePath(workspacePath, normalizedParentFolder);

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
      errorDetails(error)
    );
  }
}

export async function renameFolder(
  workspacePath: string,
  relativePath: string,
  newName: string
): Promise<RelicResult<{ path: string }>> {
  const sourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  const validatedName = validateBaseName(newName, "フォルダ名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const nextRelativePath = path.posix.join(
    path.posix.dirname(toWorkspaceRelativePath(relativePath)),
    validatedName.value
  );
  const destinationPath = await resolveNewWorkspacePath(workspacePath, nextRelativePath);

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
    const links = await updateLinksForFolderRename(workspacePath, relativePath, nextRelativePath);
    if (!links.ok) {
      await rename(destinationPath.value, sourcePath.value).catch(() => undefined);
      return links;
    }

    return ok({
      path: nextRelativePath
    });
  } catch (error) {
    return fail(
      "FOLDER_RENAME_FAILED",
      "フォルダ名を変更できませんでした。",
      errorDetails(error)
    );
  }
}

export async function moveFolder(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string
): Promise<RelicResult<{ path: string }>> {
  const sourcePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  const normalizedRelativePath = toWorkspaceRelativePath(relativePath);
  const normalizedDestFolder = toWorkspaceRelativePath(destinationFolder.trim());
  const folderName = path.posix.basename(normalizedRelativePath);
  const nextRelativePath = toWorkspaceRelativePath(
    normalizedDestFolder === "" ? folderName : `${normalizedDestFolder}/${folderName}`
  );

  if (
    normalizedDestFolder === normalizedRelativePath ||
    normalizedDestFolder.startsWith(`${normalizedRelativePath}/`)
  ) {
    return fail("FOLDER_MOVE_DESTINATION_INSIDE_SOURCE", "フォルダを自分自身の中へ移動することはできません。");
  }

  if (nextRelativePath === normalizedRelativePath) {
    return ok({ path: normalizedRelativePath });
  }

  const destinationPath = await resolveNewWorkspacePath(workspacePath, nextRelativePath);

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
    const links = await updateLinksForFolderRename(workspacePath, relativePath, nextRelativePath);
    if (!links.ok) {
      await rename(destinationPath.value, sourcePath.value).catch(() => undefined);
      return links;
    }

    return ok({ path: nextRelativePath });
  } catch (error) {
    return fail(
      "FOLDER_MOVE_FAILED",
      "フォルダを移動できませんでした。",
      errorDetails(error)
    );
  }
}
