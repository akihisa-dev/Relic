import { mkdir } from "node:fs/promises";
import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";
import { validateBaseName } from "./names";

export interface CreatedFolder {
  path: string;
}

export async function createFolder(
  workspacePath: string,
  name: string
): Promise<RelicResult<CreatedFolder>> {
  const validatedName = validateBaseName(name, "フォルダ名を入力してください。");

  if (!validatedName.ok) {
    return validatedName;
  }

  try {
    await mkdir(path.join(workspacePath, validatedName.value));

    return ok({
      path: validatedName.value
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

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "EEXIST"
  );
}
