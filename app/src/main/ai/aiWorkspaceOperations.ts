import { createHash } from "node:crypto";
import path from "node:path";

import type { AIWorkspaceFileOperation } from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { createMarkdownFileAtPath, readMarkdownFile, writeMarkdownFileContent } from "../files/markdownFiles";
import { resolveWorkspaceRelativePath } from "../files/paths";
import { moveWorkspaceItemToTrash, type TrashItem } from "../files/trash";
import type { AppliedAIWorkspaceOperations, PreparedAIWorkspaceOperations, RejectedAIWorkspaceOperation } from "./aiWorkspaceServiceTypes";

export async function applyOperation(
  workspacePath: string,
  operation: AIWorkspaceFileOperation,
  trashItem?: TrashItem
): Promise<RelicResult<void>> {
  if (operation.kind === "create") {
    const created = await createMarkdownFileAtPath(workspacePath, operation.path, operation.content ?? "");
    if (!created.ok) return created;
    return ok(undefined);
  }

  const currentFile = await readMarkdownFile(workspacePath, operation.path);
  if (!currentFile.ok) return currentFile;

  if (operation.baseContentHash && hashContent(currentFile.value.content) !== operation.baseContentHash) {
    return fail(
      "AI_WORKSPACE_STALE_OPERATION",
      "AI変更案の作成後に対象Markdownが変更されています。"
    );
  }

  if (operation.kind === "update") {
    return writeMarkdownFileContent(workspacePath, operation.path, operation.content ?? "");
  }

  if (!trashItem) {
    return fail("AI_WORKSPACE_TRASH_UNAVAILABLE", "AI変更案の削除を実行できませんでした。");
  }

  const moved = await moveWorkspaceItemToTrash(workspacePath, operation.path, "file", trashItem);
  if (!moved.ok) return moved;
  return ok(undefined);
}

export async function prepareOperations(
  workspacePath: string,
  operations: AIWorkspaceFileOperation[]
): Promise<PreparedAIWorkspaceOperations> {
  const nextOperations: AIWorkspaceFileOperation[] = [];
  const rejectedOperations: RejectedAIWorkspaceOperation[] = [];

  for (const operation of operations) {
    const pathResult = validateOperationPath(workspacePath, operation.path);
    if (!pathResult.ok) {
      rejectedOperations.push({ path: operation.path, reason: pathResult.error.message });
      continue;
    }

    if (operation.kind === "create") {
      const existingFile = await readMarkdownFile(workspacePath, pathResult.value);
      if (existingFile.ok) {
        rejectedOperations.push({
          path: pathResult.value,
          reason: "同じパスのMarkdownがすでにあるため、新規作成案としては採用しませんでした。"
        });
        continue;
      }

      nextOperations.push({ ...operation, path: pathResult.value });
      continue;
    }

    const file = await readMarkdownFile(workspacePath, pathResult.value);
    if (!file.ok) {
      rejectedOperations.push({ path: pathResult.value, reason: file.error.message });
      continue;
    }

    nextOperations.push({
      ...operation,
      baseContent: file.value.content,
      baseContentHash: hashContent(file.value.content),
      path: pathResult.value
    });
  }

  return { operations: nextOperations, rejectedOperations };
}

export async function applyPreparedOperations(
  workspacePath: string,
  operations: AIWorkspaceFileOperation[],
  dirtyFilePaths: string[],
  trashItem?: TrashItem
): Promise<AppliedAIWorkspaceOperations> {
  const dirtyPathSet = new Set(dirtyFilePaths);
  const result: AppliedAIWorkspaceOperations = {
    applied: [],
    blockedDirtyPaths: [],
    failed: [],
    stale: []
  };

  for (const operation of operations) {
    if (operation.kind !== "create" && dirtyPathSet.has(operation.path)) {
      result.blockedDirtyPaths.push(operation.path);
      continue;
    }

    const applied = await applyOperation(workspacePath, operation, trashItem);
    if (applied.ok) {
      result.applied.push(operation);
    } else if (applied.error.code === "AI_WORKSPACE_STALE_OPERATION") {
      result.stale.push(operation);
    } else {
      result.failed.push(operation);
    }
  }

  return result;
}

export function validateOperationPath(workspacePath: string, operationPath: string): RelicResult<string> {
  const normalizedPath = operationPath.replace(/\\/g, "/").trim();
  if (!normalizedPath || normalizedPath.includes("\0") || path.extname(normalizedPath) !== ".md") {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案はMarkdownファイルだけを対象にできます。");
  }

  const relativePath = operationRelativePath(workspacePath, normalizedPath);
  if (!relativePath.ok) return relativePath;

  if (relativePath.value.split("/").includes("..")) {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
  }

  const resolved = resolveWorkspaceRelativePath(workspacePath, relativePath.value);
  if (!resolved.ok) return resolved;

  return ok(relativePath.value);
}

function operationRelativePath(workspacePath: string, normalizedPath: string): RelicResult<string> {
  if (path.isAbsolute(normalizedPath)) {
    const relativePath = path.relative(workspacePath, normalizedPath);
    if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
    }

    return ok(relativePath.split(path.sep).join("/"));
  }

  if (path.win32.isAbsolute(normalizedPath)) {
    return fail("AI_WORKSPACE_OPERATION_PATH_INVALID", "AI変更案のパスがワークスペース外を指しています。");
  }

  return ok(normalizedPath);
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function blockedDirtyPaths(
  operations: AIWorkspaceFileOperation[],
  dirtyFilePaths: string[]
): string[] {
  const dirtyPathSet = new Set(dirtyFilePaths);
  const blockedPaths = new Set<string>();

  for (const operation of operations) {
    if (operation.kind !== "create" && dirtyPathSet.has(operation.path)) {
      blockedPaths.add(operation.path);
    }
  }

  return [...blockedPaths];
}
