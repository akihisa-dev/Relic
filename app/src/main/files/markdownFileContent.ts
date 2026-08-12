import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { MarkdownFileContent } from "../../shared/ipc";
import { maxMarkdownReadBytes } from "../../shared/ipc/files";
import { hasMarkdownExtension, stripMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import {
  assertMarkdownMutationSnapshotCurrent,
  captureMarkdownMutationSnapshot,
  isMarkdownMutationConflict,
  MarkdownMutationConflictError,
  runMarkdownFileMutation,
  type MarkdownMutationOperations
} from "./markdownMutationCoordinator";
import {
  type RealpathOperations,
  resolveExistingWorkspacePath,
  verifyExistingWorkspacePath
} from "./paths";

type MarkdownFileContentOperations = Partial<RealpathOperations> &
  Partial<Pick<MarkdownMutationOperations, "readFile" | "stat">>;

export async function readMarkdownFile(
  workspacePath: string,
  relativePath: string,
  operations: MarkdownFileContentOperations = {}
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

    const fileStat = await (operations.stat ?? stat)(safeFilePath.value);
    if ("isFile" in fileStat && typeof fileStat.isFile === "function" && !fileStat.isFile()) {
      return fail("FILE_READ_INVALID_FILE", "読み込めるMarkdownファイルを指定してください。");
    }
    if (!Number.isSafeInteger(fileStat.size) || fileStat.size < 0 || fileStat.size > maxMarkdownReadBytes) {
      return fail("FILE_READ_TOO_LARGE", "Markdownファイルが大きすぎるため読み込めません。", `上限: ${maxMarkdownReadBytes} bytes`);
    }
    const readRealpath = operations.realpath ?? realpath;
    const identityBeforeRead = await readRealpath(safeFilePath.value);
    const content = await (operations.readFile ?? readFile)(safeFilePath.value, "utf8");
    const identityAfterRead = await readRealpath(safeFilePath.value);
    if (identityAfterRead !== identityBeforeRead) {
      return fail("WORKSPACE_PATH_OUTSIDE", "読み込み中にMarkdownの実体が変更されたため開けません。");
    }
    if (Buffer.byteLength(content, "utf8") > maxMarkdownReadBytes) {
      return fail("FILE_READ_TOO_LARGE", "Markdownファイルが大きすぎるため読み込めません。", `上限: ${maxMarkdownReadBytes} bytes`);
    }

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
  operations: MarkdownFileContentOperations = {},
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
    return await runMarkdownFileMutation(absoluteFilePath.value, async () => {
      let snapshot: Awaited<ReturnType<typeof captureMarkdownMutationSnapshot>> | undefined;
      if (expectedContent !== undefined) {
        const safeReadPath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
        if (!safeReadPath.ok) return safeReadPath;

        try {
          snapshot = await captureMarkdownMutationSnapshot(absoluteFilePath.value, operations);
        } catch {
          return fail("FILE_WRITE_CONFLICT", "ファイルが外部で変更されています。再読み込みしてから保存してください。");
        }

        if (snapshot.content !== expectedContent) {
          return fail("FILE_WRITE_CONFLICT", "ファイルが外部で変更されています。再読み込みしてから保存してください。");
        }
        if (snapshot.content !== content && beforeWrite) {
          const recovery = await beforeWrite(snapshot.content);
          if (!recovery.ok) return recovery;
        }
      }

      const safeWritePath = await verifyExistingWorkspacePath(workspacePath, absoluteFilePath.value, operations);
      if (!safeWritePath.ok) return safeWritePath;

      try {
        await atomicWriteTextFile(
          absoluteFilePath.value,
          content,
          undefined,
          snapshot
            ? {
              beforeRename: async () => {
                const safeRenamePath = await verifyExistingWorkspacePath(
                  workspacePath,
                  absoluteFilePath.value,
                  operations
                );
                if (!safeRenamePath.ok) throw new MarkdownMutationConflictError();
                await assertMarkdownMutationSnapshotCurrent(absoluteFilePath.value, snapshot, operations);
              }
            }
            : undefined
        );
      } catch (error) {
        if (isMarkdownMutationConflict(error)) {
          return fail("FILE_WRITE_CONFLICT", "ファイルが外部で変更されています。再読み込みしてから保存してください。");
        }
        throw error;
      }

      return ok(undefined);
    });
  } catch (error) {
    return fail(
      "FILE_WRITE_FAILED",
      "ファイルを保存できませんでした。",
      errorDetails(error)
    );
  }
}
