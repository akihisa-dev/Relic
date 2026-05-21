import { stat } from "node:fs/promises";

export function errorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isCardExistsError(error: unknown): boolean {
  return isErrnoException(error, "EEXIST");
}

export function isMissingCardError(error: unknown): boolean {
  return isErrnoException(error, "ENOENT");
}

export async function pathExists(cardPath: string): Promise<boolean> {
  try {
    await stat(cardPath);
    return true;
  } catch (error) {
    return !isMissingCardError(error);
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
