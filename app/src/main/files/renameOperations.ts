import { link, lstat, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_RENAME_TEMPORARY_PATH_CANDIDATES = 1000;

export type RenameDestinationCollision = "missing" | "same-entry" | "different-entry";

export interface FileSystemEntryIdentity {
  dev: number;
  ino: number;
  kind: "directory" | "file" | "other";
}

export type SafeDirectoryRollbackResult =
  | { ok: true }
  | {
      ok: false;
      reason: "source-occupied" | "destination-changed" | "destination-missing" | "rollback-failed";
      error?: unknown;
    };

export async function getRenameDestinationCollision(
  sourcePath: string,
  destinationPath: string
): Promise<RenameDestinationCollision> {
  const sourceStats = await stat(sourcePath);

  try {
    const destinationStats = await stat(destinationPath);
    return sourceStats.dev === destinationStats.dev && sourceStats.ino === destinationStats.ino
      ? "same-entry"
      : "different-entry";
  } catch (error) {
    if (isMissingFileError(error)) return "missing";
    throw error;
  }
}

export async function renameFileSystemEntry(
  sourcePath: string,
  destinationPath: string,
  collision: RenameDestinationCollision,
  temporaryPrefix: string
): Promise<void> {
  if (collision !== "same-entry") {
    await rename(sourcePath, destinationPath);
    return;
  }

  const temporaryPath = await findAvailableTemporaryPath(
    path.dirname(sourcePath),
    temporaryPrefix
  );
  await rename(sourcePath, temporaryPath);

  try {
    await rename(temporaryPath, destinationPath);
  } catch (error) {
    await rename(temporaryPath, sourcePath).catch(() => undefined);
    throw error;
  }
}

export async function rollbackRenamedFileWithoutOverwrite(
  currentPath: string,
  originalPath: string,
  operations: {
    link(sourcePath: string, destinationPath: string): Promise<void>;
    unlink(filePath: string): Promise<void>;
  } = { link, unlink }
): Promise<void> {
  await operations.link(currentPath, originalPath);

  try {
    await operations.unlink(currentPath);
  } catch (error) {
    await operations.unlink(originalPath).catch(() => undefined);
    throw error;
  }
}

export async function readFileSystemEntryIdentity(filePath: string): Promise<FileSystemEntryIdentity> {
  const entry = await lstat(filePath);
  return {
    dev: entry.dev,
    ino: entry.ino,
    kind: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other"
  };
}

export async function rollbackRenamedDirectoryWithoutOverwrite(
  currentPath: string,
  originalPath: string,
  expectedCurrent: FileSystemEntryIdentity
): Promise<SafeDirectoryRollbackResult> {
  let original: FileSystemEntryIdentity | undefined;
  try {
    original = await readFileSystemEntryIdentity(originalPath);
  } catch (error) {
    if (!isMissingFileError(error)) {
      return { error, ok: false, reason: "rollback-failed" };
    }
    original = undefined;
  }

  if (original) {
    return { ok: false, reason: "source-occupied" };
  }

  let current: FileSystemEntryIdentity;
  try {
    current = await readFileSystemEntryIdentity(currentPath);
  } catch (error) {
    return {
      error,
      ok: false,
      reason: isMissingFileError(error) ? "destination-missing" : "rollback-failed"
    };
  }

  if (!sameFileSystemEntryIdentity(current, expectedCurrent)) {
    return { ok: false, reason: "destination-changed" };
  }

  try {
    await rename(currentPath, originalPath);
    return { ok: true };
  } catch (error) {
    return { error, ok: false, reason: "rollback-failed" };
  }
}

async function findAvailableTemporaryPath(
  parentPath: string,
  prefix: string,
  maxCandidates = DEFAULT_MAX_RENAME_TEMPORARY_PATH_CANDIDATES
): Promise<string> {
  const basePath = path.join(parentPath, `.relic-rename-${prefix}-${Date.now()}`);

  for (let index = 0; index < maxCandidates; index += 1) {
    const candidatePath = index === 0 ? basePath : `${basePath}-${index}`;

    try {
      await stat(candidatePath);
    } catch (error) {
      if (isMissingFileError(error)) return candidatePath;
      throw error;
    }
  }

  throw new Error("Rename temporary path candidates exhausted.");
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

function sameFileSystemEntryIdentity(
  left: FileSystemEntryIdentity,
  right: FileSystemEntryIdentity
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.kind === right.kind;
}
