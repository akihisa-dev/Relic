import { stat } from "node:fs/promises";

export function errorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isFileExistsError(error: unknown): boolean {
  return isErrnoException(error, "EEXIST");
}

export function isMissingFileError(error: unknown): boolean {
  return isErrnoException(error, "ENOENT");
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    return !isMissingFileError(error);
  }
}

function isErrnoException(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
