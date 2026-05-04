import path from "node:path";

import { fail, ok, type RelicResult } from "../../shared/result";

export function resolveWorkspaceRelativePath(
  workspacePath: string,
  relativePath: string
): RelicResult<string> {
  if (path.isAbsolute(relativePath)) {
    return fail("WORKSPACE_PATH_INVALID", "ワークスペース内の相対パスを指定してください。");
  }

  const normalizedRelativePath = relativePath.split("/").join(path.sep);
  const absolutePath = path.resolve(workspacePath, normalizedRelativePath);
  const relativeFromWorkspace = path.relative(workspacePath, absolutePath);

  if (
    relativeFromWorkspace === "" ||
    relativeFromWorkspace.startsWith("..") ||
    path.isAbsolute(relativeFromWorkspace)
  ) {
    return fail("WORKSPACE_PATH_OUTSIDE", "ワークスペース外のファイルは開けません。");
  }

  return ok(absolutePath);
}
