import { readFile } from "node:fs/promises";

import type {
  ApplyUnlinkedReferenceInput,
  ApplyUnlinkedReferenceResult,
  UnlinkedReference,
  UnlinkedReferencesResult
} from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath, resolveWorkspaceRelativePath, verifyExistingWorkspacePath } from "./paths";
import {
  applyUnlinkedReferenceToMarkdown,
  collectUnlinkedReferencesInMarkdown
} from "./unlinkedReferencesModel";
import {
  createWorkspaceDerivedDataCache,
  markdownContentForRecord,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

interface UnlinkedReferenceWriteOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  writeTextFile(filePath: string, content: string): Promise<void>;
}

const defaultUnlinkedReferenceWriteOperations: UnlinkedReferenceWriteOperations = {
  readFile,
  writeTextFile: atomicWriteTextFile
};

export const unlinkedReferencesMaxResults = 500;

export async function readUnlinkedReferences(
  workspacePath: string,
  targetRelativePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = {}
): Promise<RelicResult<UnlinkedReferencesResult>> {
  if (!hasMarkdownExtension(targetRelativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけ未リンク参照を確認できます。");
  }

  const targetPath = resolveWorkspaceRelativePath(workspacePath, targetRelativePath);
  if (!targetPath.ok) return targetPath;

  try {
    const options = normalizeWorkspaceDerivedDataOptions(optionsOrOperations);
    const parseCache = options.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, options);
    const existingMarkdownPaths = fileIndex.entries.map((entry) => entry.path);
    if (!existingMarkdownPaths.includes(targetRelativePath)) {
      return ok({ references: [], skippedUnreadableFileCount: 0, truncated: false });
    }

    const references: UnlinkedReference[] = [];
    let truncated = false;

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      if (record.path === targetRelativePath) continue;

      const content = markdownContentForRecord(record, parseCache);
      const referencesInFile = collectUnlinkedReferencesInMarkdown(content, {
        existingMarkdownPaths,
        sourcePath: record.path,
        targetPath: targetRelativePath
      });

      for (const reference of referencesInFile) {
        references.push(reference);
        if (references.length >= unlinkedReferencesMaxResults) {
          truncated = true;
          break;
        }
      }

      if (truncated) break;
    }

    return ok({
      references: references.sort((a, b) => (
        a.sourceName.localeCompare(b.sourceName, "ja") ||
        a.lineNumber - b.lineNumber ||
        a.from - b.from
      )),
      skippedUnreadableFileCount: fileIndex.entries.filter((entry) => entry.readStatus === "unreadable").length,
      truncated
    });
  } catch (error) {
    return fail(
      "UNLINKED_REFERENCES_READ_FAILED",
      "未リンク参照を読み込めませんでした。",
      errorDetails(error)
    );
  }
}

export async function applyUnlinkedReference(
  workspacePath: string,
  input: ApplyUnlinkedReferenceInput,
  operations: UnlinkedReferenceWriteOperations = defaultUnlinkedReferenceWriteOperations
): Promise<RelicResult<ApplyUnlinkedReferenceResult>> {
  if (!hasMarkdownExtension(input.sourcePath) || !hasMarkdownExtension(input.targetPath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけ未リンク参照をリンク化できます。");
  }

  const sourcePath = await resolveExistingWorkspacePath(workspacePath, input.sourcePath);
  if (!sourcePath.ok) return sourcePath;

  const targetPath = await resolveExistingWorkspacePath(workspacePath, input.targetPath);
  if (!targetPath.ok) return targetPath;

  const safeWritePath = await verifyExistingWorkspacePath(workspacePath, sourcePath.value);
  if (!safeWritePath.ok) return safeWritePath;

  try {
    const content = await operations.readFile(sourcePath.value, "utf8");
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath);
    const existingMarkdownPaths = fileIndex.entries.map((entry) => entry.path);
    const linkText = collectUnlinkedReferencesInMarkdown(content, {
      existingMarkdownPaths,
      sourcePath: input.sourcePath,
      targetPath: input.targetPath
    }).find((reference) => (
      reference.from === input.from &&
      reference.to === input.to &&
      reference.matchText === input.matchText
    ))?.linkText;

    if (!linkText) {
      return fail("UNLINKED_REFERENCE_STALE", "未リンク参照の候補が更新されています。再読み込みしてからリンク化してください。");
    }

    const updated = applyUnlinkedReferenceToMarkdown(content, {
      from: input.from,
      linkText,
      matchText: input.matchText,
      to: input.to
    });

    if (updated === null) {
      return fail("UNLINKED_REFERENCE_STALE", "未リンク参照の候補が更新されています。再読み込みしてからリンク化してください。");
    }

    await operations.writeTextFile(sourcePath.value, updated);

    return ok({
      content: updated,
      sourcePath: input.sourcePath
    });
  } catch (error) {
    return fail(
      "UNLINKED_REFERENCE_APPLY_FAILED",
      "未リンク参照をリンク化できませんでした。",
      errorDetails(error)
    );
  }
}
