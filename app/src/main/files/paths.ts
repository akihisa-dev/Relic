import { realpath } from "node:fs/promises";
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
    return fail("WORKSPACE_PATH_INVALID", "ワークスペース内の相対パスを指定してください。");
  }

  const normalizedRelativePath = normalizedInput.split("/").join(path.sep);
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

export async function resolveExistingWorkspacePath(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<string>> {
  const resolved = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!resolved.ok) return resolved;

  let realWorkspace: string;
  let realTarget: string;

  try {
    realWorkspace = await realpath(workspacePath);
    realTarget = await realpath(resolved.value);
  } catch {
    return fail("WORKSPACE_PATH_INVALID", "ワークスペース内のファイルを確認できませんでした。");
  }

  if (!isPathInside(realWorkspace, realTarget)) {
    return fail("WORKSPACE_PATH_OUTSIDE", "ワークスペース外のファイルは開けません。");
  }

  return ok(resolved.value);
}

export async function resolveNewWorkspacePath(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<string>> {
  const resolved = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!resolved.ok) return resolved;

  let realWorkspace: string;
  let realParent: string;

  try {
    realWorkspace = await realpath(workspacePath);
    realParent = await realpathNearestExistingParent(workspacePath, path.dirname(resolved.value));
  } catch {
    return fail("WORKSPACE_PATH_INVALID", "ワークスペース内のファイルを確認できませんでした。");
  }

  if (!isPathInside(realWorkspace, realParent)) {
    return fail("WORKSPACE_PATH_OUTSIDE", "ワークスペース外のファイルは開けません。");
  }

  return ok(resolved.value);
}

export async function resolveExistingWorkspacePathOrRoot(
  workspacePath: string,
  relativePath: string
): Promise<RelicResult<string>> {
  const resolved = resolveWorkspaceRelativePathOrRoot(workspacePath, relativePath);

  if (!resolved.ok) return resolved;

  let realWorkspace: string;
  let realTarget: string;

  try {
    realWorkspace = await realpath(workspacePath);
    realTarget = await realpath(resolved.value);
  } catch {
    return fail("WORKSPACE_PATH_INVALID", "ワークスペース内のファイルを確認できませんでした。");
  }

  if (!isPathInside(realWorkspace, realTarget)) {
    return fail("WORKSPACE_PATH_OUTSIDE", "ワークスペース外のファイルは開けません。");
  }

  return ok(resolved.value);
}

function isPathInside(realWorkspacePath: string, realTargetPath: string): boolean {
  const relativeFromWorkspace = path.relative(realWorkspacePath, realTargetPath);

  return relativeFromWorkspace === "" ||
    (!relativeFromWorkspace.startsWith("..") && !path.isAbsolute(relativeFromWorkspace));
}

async function realpathNearestExistingParent(workspacePath: string, parentPath: string): Promise<string> {
  let current = parentPath;

  while (true) {
    const relativeFromWorkspace = path.relative(workspacePath, current);
    if (relativeFromWorkspace.startsWith("..") || path.isAbsolute(relativeFromWorkspace)) {
      throw new Error("Parent path is outside workspace.");
    }

    try {
      return await realpath(current);
    } catch {
      const next = path.dirname(current);
      if (next === current) throw new Error("No existing parent path.");
      current = next;
    }
  }
}
