import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails, isCardExistsError, pathExists } from "./fsState";
import { updateLinksForCardFolderRename } from "./linkUpdater";
import { validateBaseName } from "./names";
import { resolveCardbookRelativePath, toCardbookRelativePath } from "./paths";

export interface CreatedCardFolder {
  path: string;
}

export async function createCardFolder(
  cardbookPath: string,
  name: string,
  parentCardFolder = ""
): Promise<RelicResult<CreatedCardFolder>> {
  const validatedName = validateBaseName(name, "カードフォルダ名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const normalizedParentCardFolder = toCardbookRelativePath(parentCardFolder.trim());
  const nextRelativePath = toCardbookRelativePath(
    normalizedParentCardFolder === "" ? validatedName.value : `${normalizedParentCardFolder}/${validatedName.value}`
  );
  const parentPath =
    normalizedParentCardFolder === "" ? ok(cardbookPath) : resolveCardbookRelativePath(cardbookPath, normalizedParentCardFolder);

  if (!parentPath.ok) {
    return parentPath;
  }

  try {
    await mkdir(path.join(parentPath.value, validatedName.value));

    return ok({
      path: nextRelativePath
    });
  } catch (error) {
    if (isCardExistsError(error)) {
      return fail("FOLDER_ALREADY_EXISTS", "同じ名前のカードフォルダまたはカードがすでにあります。");
    }

    return fail(
      "FOLDER_CREATE_FAILED",
      "カードフォルダを作成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function renameCardFolder(
  cardbookPath: string,
  relativePath: string,
  newName: string
): Promise<RelicResult<{ path: string }>> {
  const sourcePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  const validatedName = validateBaseName(newName, "カードフォルダ名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  const nextRelativePath = toCardbookRelativePath(path.join(path.dirname(relativePath), validatedName.value));
  const destinationPath = resolveCardbookRelativePath(cardbookPath, nextRelativePath);

  if (!destinationPath.ok) {
    return destinationPath;
  }

  if (sourcePath.value === destinationPath.value) {
    return ok({ path: relativePath });
  }

  if (await pathExists(destinationPath.value)) {
    return fail("FOLDER_ALREADY_EXISTS", "同じ名前のカードフォルダまたはカードがすでにあります。");
  }

  try {
    const sourceStats = await stat(sourcePath.value);

    if (!sourceStats.isDirectory()) {
      return fail("FOLDER_RENAME_NOT_DIRECTORY", "カードフォルダだけをリネームできます。");
    }

    await rename(sourcePath.value, destinationPath.value);
    await updateLinksForCardFolderRename(cardbookPath, relativePath, nextRelativePath);

    return ok({
      path: nextRelativePath
    });
  } catch (error) {
    return fail(
      "FOLDER_RENAME_FAILED",
      "カードフォルダ名を変更できませんでした。",
      errorDetails(error)
    );
  }
}

export async function moveCardFolder(
  cardbookPath: string,
  relativePath: string,
  destinationCardFolder: string
): Promise<RelicResult<{ path: string }>> {
  const sourcePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!sourcePath.ok) {
    return sourcePath;
  }

  const normalizedDestCardFolder = toCardbookRelativePath(destinationCardFolder.trim());
  const cardFolderName = path.basename(relativePath);
  const nextRelativePath = toCardbookRelativePath(
    normalizedDestCardFolder === "" ? cardFolderName : `${normalizedDestCardFolder}/${cardFolderName}`
  );

  if (nextRelativePath === relativePath) {
    return ok({ path: relativePath });
  }

  const destinationPath = resolveCardbookRelativePath(cardbookPath, nextRelativePath);

  if (!destinationPath.ok) {
    return destinationPath;
  }

  if (await pathExists(destinationPath.value)) {
    return fail("FOLDER_ALREADY_EXISTS", "移動先に同じ名前のカードフォルダまたはカードがすでにあります。");
  }

  try {
    const sourceStats = await stat(sourcePath.value);

    if (!sourceStats.isDirectory()) {
      return fail("FOLDER_MOVE_NOT_DIRECTORY", "カードフォルダだけを移動できます。");
    }

    await rename(sourcePath.value, destinationPath.value);
    await updateLinksForCardFolderRename(cardbookPath, relativePath, nextRelativePath);

    return ok({ path: nextRelativePath });
  } catch (error) {
    return fail(
      "FOLDER_MOVE_FAILED",
      "カードフォルダを移動できませんでした。",
      errorDetails(error)
    );
  }
}
