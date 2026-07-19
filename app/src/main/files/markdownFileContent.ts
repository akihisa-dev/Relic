import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import {
  type RealpathOperations,
  resolveExistingWorkspacePath,
  verifyExistingWorkspacePath
} from "./paths";

export async function readMarkdownFile(
  workspacePath: string,
  relativePath: string,
  operations: Partial<RealpathOperations> = {}
): Promise<RelicResult<MarkdownFileContent>> {
  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを開けます。");
  }

  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  try {
    const safeFilePath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeFilePath.ok) return safeFilePath;

    const content = await readFile(absoluteFilePath.value, "utf8");

    return ok({
      content,
      name: stripMarkdownExtension(path.basename(relativePath)),
      path: relativePath
    });
  } catch (error) {
    return fail(
      "FILE_READ_FAILED",
      "ファイルを読み込めませんでした。",
      errorDetails(error)
    );
  }
}
export async function writeMarkdownFileContent(
  workspacePath: string,
  relativePath: string,
  content: string,
  expectedContent?: string,
  operations: Partial<RealpathOperations> = {},
  beforeWrite?: (previousContent: string) => Promise<RelicResult<void>>
): Promise<RelicResult<void>> {
  const absoluteFilePath = await resolveExistingWorkspacePath(workspacePath, relativePath, operations);

  if (!absoluteFilePath.ok) {
    return absoluteFilePath;
  }

  if (!hasMarkdownExtension(absoluteFilePath.value)) {
    return fail("FILE_WRITE_NOT_MARKDOWN", "Markdownファイル以外は書き込めません。");
  }

  try {
    if (expectedContent !== undefined) {
      const safeReadPath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
      if (!safeReadPath.ok) return safeReadPath;

      const currentContent = await readFile(absoluteFilePath.value, "utf8");
      if (currentContent !== expectedContent) {
        return fail("FILE_WRITE_CONFLICT", "ファイルが外部で変更されています。再読み込みしてから保存してください。");
      }
      if (currentContent !== content && beforeWrite) {
        const recovery = await beforeWrite(currentContent);
        if (!recovery.ok) return recovery;
      }
    }

    const safeWritePath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
    if (!safeWritePath.ok) return safeWritePath;

    await atomicWriteTextFile(absoluteFilePath.value, content);

    return ok(undefined);
  } catch (error) {
    return fail(
      "FILE_WRITE_FAILED",
      "ファイルを保存できませんでした。",
      errorDetails(error)
    );
  }
}
