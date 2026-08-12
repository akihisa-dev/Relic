import { mkdir } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails, isFileExistsError } from "./fileSystem";
import { updateLinksForFolderRename } from "./linkUpdater";
import type { LinkUpdateRecovery, LinkUpdateTransactionResult } from "./linkUpdater";
import { validateBaseName } from "./names";
import {
  resolveExistingWorkspacePath,
  resolveExistingWorkspacePathOrRoot,
  resolveNewWorkspacePath,
  toWorkspaceRelativePath,
  verifyExistingWorkspacePath,
  verifyNewWorkspacePath
} from "./paths";
import {
  getRenameDestinationCollision,
  readFileSystemEntryIdentity,
  renameFileSystemEntry,
  rollbackRenamedDirectoryWithoutOverwrite,
  type FileSystemEntryIdentity
} from "./renameOperations";

export interface CreatedFolder {
  path: string;
}

export interface FolderRelocationOperations {
  updateLinks(
    workspacePath: string,
    oldRelativePath: string,
    newRelativePath: string
  ): Promise<LinkUpdateTransactionResult>;
}

const defaultFolderRelocationOperations: FolderRelocationOperations = {
  updateLinks: updateLinksForFolderRename
};

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
    const destinationPath = path.join(parentPath.value, validatedName.value);
    const safeDestinationPath = await verifyNewWorkspacePath(workspacePath, destinationPath);
    if (!safeDestinationPath.ok) return safeDestinationPath;

    await mkdir(destinationPath);

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
  newName: string,
  relocationOperations: Partial<FolderRelocationOperations> = {}
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

  return moveFolderToPath(workspacePath, {
    alreadyExistsMessage: "同じ名前のフォルダまたはファイルがすでにあります。",
    destinationPath,
    failureCode: "FOLDER_RENAME_FAILED",
    failureMessage: "フォルダ名を変更できませんでした。",
    nextRelativePath,
    notDirectoryCode: "FOLDER_RENAME_NOT_DIRECTORY",
    notDirectoryMessage: "フォルダだけをリネームできます。",
    relativePath,
    samePathReturnPath: relativePath,
    sourcePath: sourcePath.value,
    relocationOperations
  });
}

export async function moveFolder(
  workspacePath: string,
  relativePath: string,
  destinationFolder: string,
  relocationOperations: Partial<FolderRelocationOperations> = {}
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

  return moveFolderToPath(workspacePath, {
    alreadyExistsMessage: "移動先に同じ名前のフォルダまたはファイルがすでにあります。",
    destinationPath,
    failureCode: "FOLDER_MOVE_FAILED",
    failureMessage: "フォルダを移動できませんでした。",
    nextRelativePath,
    notDirectoryCode: "FOLDER_MOVE_NOT_DIRECTORY",
    notDirectoryMessage: "フォルダだけを移動できます。",
    relativePath,
    sourcePath: sourcePath.value,
    relocationOperations
  });
}

async function moveFolderToPath(
  workspacePath: string,
  options: {
    alreadyExistsMessage: string;
    destinationPath: RelicResult<string>;
    failureCode: "FOLDER_RENAME_FAILED" | "FOLDER_MOVE_FAILED";
    failureMessage: string;
    nextRelativePath: string;
    notDirectoryCode: "FOLDER_RENAME_NOT_DIRECTORY" | "FOLDER_MOVE_NOT_DIRECTORY";
    notDirectoryMessage: string;
    relativePath: string;
    samePathReturnPath?: string;
    sourcePath: string;
    relocationOperations?: Partial<FolderRelocationOperations>;
  }
): Promise<RelicResult<{ path: string }>> {
  if (!options.destinationPath.ok) {
    return options.destinationPath;
  }

  if (options.sourcePath === options.destinationPath.value) {
    return ok({ path: options.samePathReturnPath ?? options.nextRelativePath });
  }

  const collision = await getRenameDestinationCollision(options.sourcePath, options.destinationPath.value);

  if (collision === "different-entry") {
    return fail("FOLDER_ALREADY_EXISTS", options.alreadyExistsMessage);
  }

  try {
    const safeSourcePath = await verifyExistingWorkspacePath(workspacePath, options.sourcePath);
    if (!safeSourcePath.ok) return safeSourcePath;

    const safeDestinationPath = await verifyNewWorkspacePath(workspacePath, options.destinationPath.value);
    if (!safeDestinationPath.ok) return safeDestinationPath;

    const sourceIdentity = await readFileSystemEntryIdentity(options.sourcePath);

    if (sourceIdentity.kind !== "directory") {
      return fail(options.notDirectoryCode, options.notDirectoryMessage);
    }

    await renameFileSystemEntry(
      options.sourcePath,
      options.destinationPath.value,
      collision,
      path.basename(options.sourcePath)
    );
    const expectedIdentity: FileSystemEntryIdentity = {
      dev: sourceIdentity.dev,
      ino: sourceIdentity.ino,
      kind: "directory"
    };
    let movedIdentity: FileSystemEntryIdentity;
    try {
      movedIdentity = await readFileSystemEntryIdentity(options.destinationPath.value);
    } catch (error) {
      return folderRollbackFailure(
        options,
        "destination-missing",
        error
      );
    }
    if (movedIdentity.dev !== expectedIdentity.dev || movedIdentity.ino !== expectedIdentity.ino) {
      return folderRollbackFailure(options, "destination-changed");
    }

    let links: LinkUpdateTransactionResult;
    try {
      links = await {
        ...defaultFolderRelocationOperations,
        ...options.relocationOperations
      }.updateLinks(workspacePath, options.relativePath, options.nextRelativePath);
    } catch (error) {
      const rollback = await rollbackRenamedDirectoryWithoutOverwrite(
        options.destinationPath.value,
        options.sourcePath,
        movedIdentity
      );
      if (!rollback.ok) return folderRollbackFailure(options, rollback.reason, rollback.error ?? error);
      return fail(options.failureCode, options.failureMessage, errorDetails(error));
    }
    if (!links.ok) {
      const rollback = await rollbackRenamedDirectoryWithoutOverwrite(
        options.destinationPath.value,
        options.sourcePath,
        movedIdentity
      );
      if (!rollback.ok) {
        return folderRollbackFailure(options, rollback.reason, rollback.error, links.recovery);
      }
      return links;
    }

    return ok({ path: options.nextRelativePath });
  } catch (error) {
    return fail(
      options.failureCode,
      options.failureMessage,
      errorDetails(error)
    );
  }
}

function folderRollbackFailure(
  options: {
    failureCode: "FOLDER_RENAME_FAILED" | "FOLDER_MOVE_FAILED";
    failureMessage: string;
    nextRelativePath: string;
    relativePath: string;
  },
  reason: string,
  error?: unknown,
  linkRecovery?: LinkUpdateRecovery
): RelicResult<never> {
  return fail(
    options.failureCode,
    `${options.failureMessage}安全に元へ戻せませんでした。外部変更を確認してください。`,
    error ? errorDetails(error) : undefined,
    {
      status: "recovery-required",
      currentPath: options.nextRelativePath,
      oldPath: options.relativePath,
      reason,
      ...(linkRecovery ? { linkUpdates: linkRecovery } : {})
    }
  );
}
