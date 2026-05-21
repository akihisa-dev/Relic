import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";

export function toCardbookRelativePath(cardPath: string): string {
  return cardPath.split(path.sep).join("/");
}

export function resolveCardbookRelativePath(
  cardbookPath: string,
  relativePath: string
): RelicResult<string> {
  const normalizedInput = relativePath.replace(/\\/g, "/");

  if (path.posix.isAbsolute(normalizedInput) || path.win32.isAbsolute(normalizedInput)) {
    return fail("CARDBOOK_PATH_INVALID", "カードブック内の相対パスを指定してください。");
  }

  const normalizedRelativePath = normalizedInput.split("/").join(path.sep);
  const absolutePath = path.resolve(cardbookPath, normalizedRelativePath);
  const relativeFromCardbook = path.relative(cardbookPath, absolutePath);

  if (
    relativeFromCardbook === "" ||
    relativeFromCardbook.startsWith("..") ||
    path.isAbsolute(relativeFromCardbook)
  ) {
    return fail("CARDBOOK_PATH_OUTSIDE", "カードブック外のカードは開けません。");
  }

  return ok(absolutePath);
}

export function resolveCardbookRelativePathOrRoot(
  cardbookPath: string,
  relativePath: string
): RelicResult<string> {
  const normalizedInput = relativePath.replace(/\\/g, "/").trim();

  if (normalizedInput === "" || normalizedInput === ".") {
    return ok(cardbookPath);
  }

  return resolveCardbookRelativePath(cardbookPath, relativePath);
}
