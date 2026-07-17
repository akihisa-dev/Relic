import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";

const windowsReservedBaseNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
const windowsInvalidNameCharacters = /[<>:"/\\|?*\x00-\x1F]/;

export function hasHiddenPathSegment(filePath: string): boolean {
  return filePath.replace(/\\/g, "/").split("/").some((segment) => (
    segment !== "." && segment !== ".." && segment.startsWith(".")
  ));
}

export function validateBaseName(name: string, emptyMessage: string): RelicResult<string> {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return fail("FILE_NAME_EMPTY", emptyMessage);
  }

  if (hasHiddenPathSegment(trimmedName)) {
    return fail("FILE_NAME_HIDDEN", "名前が . で始まる項目はRelicでは使用できません。");
  }

  if (/[. ]$/.test(name)) {
    return fail("FILE_NAME_INVALID", "名前の末尾に . や空白は使えません。");
  }

  if (windowsInvalidNameCharacters.test(trimmedName)) {
    return fail("FILE_NAME_INVALID", "名前に使えない文字が含まれています。");
  }

  if (path.basename(trimmedName) !== trimmedName) {
    return fail("FILE_NAME_INVALID", "名前にフォルダ区切りは使えません。");
  }

  const baseNameWithoutExtension = trimmedName.split(".")[0]?.trimEnd() ?? "";

  if (windowsReservedBaseNames.test(baseNameWithoutExtension)) {
    return fail("FILE_NAME_INVALID", "この名前はシステムで予約されているため使えません。");
  }

  return ok(trimmedName);
}
