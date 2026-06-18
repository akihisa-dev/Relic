import { rename, stat } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_RENAME_TEMPORARY_PATH_CANDIDATES = 1000;

export type RenameDestinationCollision = "missing" | "same-entry" | "different-entry";

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
