import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";

export function toWorkspaceRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function resolveWorkspaceRelativePath(
  workspacePath: string,
  relativePath: string
): RelicResult<string> {
  const normalizedInput = relativePath.replace(/\\/g, "/");

  if (path.posix.isAbsolute(normalizedInput) || path.win32.isAbsolute(normalizedInput)) {
    return fail("WORKSPACE_PATH_INVALID", "カードブック内の相対パスを指定してください。");
  }

  const normalizedRelativePath = normalizedInput.split("/").join(path.sep);
  const absolutePath = path.resolve(workspacePath, normalizedRelativePath);
  const relativeFromWorkspace = path.relative(workspacePath, absolutePath);

  if (
    relativeFromWorkspace === "" ||
    relativeFromWorkspace.startsWith("..") ||
    path.isAbsolute(relativeFromWorkspace)
  ) {
    return fail("WORKSPACE_PATH_OUTSIDE", "カードブック外のカードは開けません。");
  }

  return ok(absolutePath);
}

export function resolveWorkspaceRelativePathOrRoot(
  workspacePath: string,
  relativePath: string
): RelicResult<string> {
  const normalizedInput = relativePath.replace(/\\/g, "/").trim();

  if (normalizedInput === "" || normalizedInput === ".") {
    return ok(workspacePath);
  }

  return resolveWorkspaceRelativePath(workspacePath, relativePath);
}
