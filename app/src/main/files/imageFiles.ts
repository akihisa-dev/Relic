import { constants } from "node:fs";
import { copyFile, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails, isFileExistsError } from "./fileSystem";
import { createCopyRelativePath } from "./markdownFilePaths";
import {
  resolveExistingWorkspacePath,
  resolveNewWorkspacePath,
  toWorkspaceRelativePath,
  verifyExistingWorkspacePath,
  verifyNewWorkspacePath
} from "./paths";
import { validateBaseName } from "./names";

export interface ImportedImageFile {
  path: string;
}

export interface ReadImageFile {
  dataUrl: string;
}

export interface ImageFileOperations {
  copyFile: typeof copyFile;
  readFile: typeof readFile;
  stat: typeof stat;
}

const defaultImageFileOperations: ImageFileOperations = {
  copyFile,
  readFile,
  stat
};

const imageMimeTypes = new Map<string, string>([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

export async function importImageFile(
  workspacePath: string,
  sourcePath: string,
  destinationFolder: string,
  operations: Partial<ImageFileOperations> = {}
): Promise<RelicResult<ImportedImageFile>> {
  const ops = { ...defaultImageFileOperations, ...operations };
  const normalizedSourcePath = sourcePath.trim();

  if (normalizedSourcePath === "" || normalizedSourcePath.includes("\0")) {
    return fail("IMAGE_IMPORT_SOURCE_INVALID", "追加できる画像ファイルを指定してください。");
  }

  if (!isSupportedMarkdownImagePath(normalizedSourcePath)) {
    return fail("IMAGE_IMPORT_TYPE_UNSUPPORTED", "対応している画像ファイルだけを追加できます。");
  }

  try {
    const sourceStat = await ops.stat(normalizedSourcePath);
    if (!sourceStat.isFile()) {
      return fail("IMAGE_IMPORT_SOURCE_INVALID", "追加できる画像ファイルを指定してください。");
    }

    const existingWorkspaceRelativePath = workspaceRelativePathForExistingSource(workspacePath, normalizedSourcePath);
    if (existingWorkspaceRelativePath) {
      const safeExistingPath = await verifyExistingWorkspacePath(workspacePath, normalizedSourcePath);
      if (!safeExistingPath.ok) return safeExistingPath;

      return ok({ path: existingWorkspaceRelativePath });
    }

    const validatedName = validateBaseName(path.basename(normalizedSourcePath), "画像ファイル名を確認してください。");
    if (!validatedName.ok) return validatedName;

    const destinationRelativePath = toWorkspaceRelativePath(
      destinationFolder === ""
        ? validatedName.value
        : path.posix.join(destinationFolder, validatedName.value)
    );
    const destinationPath = await resolveNewWorkspacePath(workspacePath, destinationRelativePath);
    if (!destinationPath.ok) return destinationPath;

    const safeDestinationPath = await verifyNewWorkspacePath(workspacePath, destinationPath.value);
    if (!safeDestinationPath.ok) return safeDestinationPath;

    const finalRelativePath = await nextAvailableImagePath(workspacePath, destinationRelativePath);
    const finalDestinationPath = await resolveNewWorkspacePath(workspacePath, finalRelativePath);
    if (!finalDestinationPath.ok) return finalDestinationPath;

    await ops.copyFile(normalizedSourcePath, finalDestinationPath.value, constants.COPYFILE_EXCL);

    return ok({ path: finalRelativePath });
  } catch (error) {
    if (isFileExistsError(error)) {
      return fail("IMAGE_ALREADY_EXISTS", "追加先に同じ名前の画像ファイルがすでにあります。");
    }

    return fail(
      "IMAGE_IMPORT_FAILED",
      "画像ファイルを追加できませんでした。",
      errorDetails(error)
    );
  }
}

export async function readImageFile(
  workspacePath: string,
  relativePath: string,
  operations: Partial<ImageFileOperations> = {}
): Promise<RelicResult<ReadImageFile>> {
  const ops = { ...defaultImageFileOperations, ...operations };

  if (!isSupportedMarkdownImagePath(relativePath)) {
    return fail("IMAGE_READ_TYPE_UNSUPPORTED", "対応している画像ファイルだけを表示できます。");
  }

  const resolvedPath = await resolveExistingWorkspacePath(workspacePath, relativePath);
  if (!resolvedPath.ok) return resolvedPath;

  try {
    const fileStat = await ops.stat(resolvedPath.value);
    if (!fileStat.isFile()) {
      return fail("IMAGE_READ_INVALID_FILE", "表示できる画像ファイルを指定してください。");
    }

    const extension = path.extname(relativePath).toLowerCase();
    const mimeType = imageMimeTypes.get(extension);
    if (!mimeType) {
      return fail("IMAGE_READ_TYPE_UNSUPPORTED", "対応している画像ファイルだけを表示できます。");
    }

    const safeReadPath = await verifyExistingWorkspacePath(workspacePath, resolvedPath.value);
    if (!safeReadPath.ok) return safeReadPath;

    const imageBuffer = await ops.readFile(safeReadPath.value);
    return ok({ dataUrl: `data:${mimeType};base64,${imageBuffer.toString("base64")}` });
  } catch (error) {
    return fail(
      "IMAGE_READ_FAILED",
      "画像ファイルを表示できませんでした。",
      errorDetails(error)
    );
  }
}

function workspaceRelativePathForExistingSource(workspacePath: string, sourcePath: string): string | null {
  const relativePath = path.relative(workspacePath, sourcePath);

  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return toWorkspaceRelativePath(relativePath);
}

async function nextAvailableImagePath(workspacePath: string, relativePath: string): Promise<string> {
  const resolvedPath = await resolveNewWorkspacePath(workspacePath, relativePath);
  if (!resolvedPath.ok) throw new Error(resolvedPath.error.message);

  try {
    await stat(resolvedPath.value);
    return createCopyRelativePath(workspacePath, relativePath);
  } catch {
    return relativePath;
  }
}
