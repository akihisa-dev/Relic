import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";

export function validateBaseName(name: string, emptyMessage: string): RelicResult<string> {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return fail("FILE_NAME_EMPTY", emptyMessage);
  }

  if (trimmedName.includes("/") || trimmedName.includes("\\")) {
    return fail("FILE_NAME_INVALID", "名前に / は使えません。");
  }

  if (path.basename(trimmedName) !== trimmedName) {
    return fail("FILE_NAME_INVALID", "名前にカードフォルダ区切りは使えません。");
  }

  return ok(trimmedName);
}
