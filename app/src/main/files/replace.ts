import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

import type {
  ApplySearchAndReplaceResult,
  ReplaceInFileResult,
  SearchAndReplaceFileSnapshot,
  SearchAndReplaceMatch,
  SearchAndReplacePreviewResult
} from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { maxMarkdownReadBytes } from "../../shared/ipc/files";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { atomicWriteTextFile } from "./atomicWrite";
import { mapWithConcurrency } from "./concurrency";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import {
  assertMarkdownMutationSnapshotCurrent,
  captureMarkdownMutationSnapshot,
  isMarkdownMutationConflict,
  runMarkdownFileMutation,
  type MarkdownMutationOperations,
  type MarkdownMutationSnapshot
} from "./markdownMutationCoordinator";
import { resolveExistingWorkspacePath, verifyExistingWorkspacePath } from "./paths";
import { applyReplacement, buildReplacementPreviewLine, buildReplacementRegex, canMatchEmptyTextInContent } from "./replaceModel";
import { isRegexSafeLine, validateRegexTargetText } from "./regexSafety";

interface SearchAndReplaceReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat?: MarkdownMutationOperations["stat"];
}

interface SearchAndReplaceWriteOperations extends SearchAndReplaceReadOperations {
  stat?: MarkdownMutationOperations["stat"];
  writeTextFile?: (filePath: string, content: string) => Promise<void>;
}

interface SearchAndReplaceTarget {
  absolutePath: string;
  content: string;
  relativePath: string;
}

interface SearchAndReplaceTargetsResult {
  skippedUnreadableFiles: string[];
  targets: SearchAndReplaceTarget[];
}

export const searchAndReplacePreviewMaxResults = 500;
export const maxReplaceTargetFiles = 50_000;
export const maxReplaceReadBytes = maxMarkdownReadBytes;
export const maxReplaceAggregateReadBytes = 64 * 1024 * 1024;
const maxConcurrentReplaceReads = 8;

const defaultSearchAndReplaceOperations: SearchAndReplaceWriteOperations = {
  readFile,
  stat,
  writeTextFile: atomicWriteTextFile
};

export async function replaceInFile(
  workspacePath: string,
  relativePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean,
  operations: SearchAndReplaceWriteOperations = defaultSearchAndReplaceOperations
): Promise<RelicResult<ReplaceInFileResult>> {
  if (searchQuery.trim() === "") {
    return fail("REPLACE_EMPTY_QUERY", "検索語句を入力してください。");
  }

  if (!hasMarkdownExtension(relativePath)) {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを対象にできます。");
  }

  const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);

  if (!absolutePath.ok) {
    return absolutePath;
  }

  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    return await runMarkdownFileMutation(absolutePath.value, async () => {
      const snapshot = await captureMarkdownMutationSnapshot(absolutePath.value, operations);
      const content = snapshot.content;
      if (isRegex) {
        const safeTarget = validateRegexTargetText(content, "置換");
        if (!safeTarget.ok) return safeTarget;
      }

      if (isRegex && canMatchEmptyTextInContent(regex.value, content)) {
        return fail("REPLACE_REGEX_EMPTY_MATCH", "空文字に一致する正規表現は置換できません。");
      }

      const matches = content.match(regex.value);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        const updated = applyReplacement(content, regex.value, replacement, isRegex);
        const safeWritePath = await verifyExistingWorkspacePath(workspacePath, absolutePath.value);
        if (!safeWritePath.ok) return safeWritePath;

        await writeReplaceMutation(absolutePath.value, updated, snapshot, operations);
      }

      return ok({ count });
    });
  } catch (error) {
    if (isMarkdownMutationConflict(error)) {
      return fail("REPLACE_FAILED", "ファイルが外部で変更されています。再読み込みしてから置換してください。");
    }
    return fail(
      "REPLACE_FAILED",
      "置換できませんでした。",
      errorDetails(error)
    );
  }
}

async function writeReplaceMutation(
  filePath: string,
  content: string,
  snapshot: MarkdownMutationSnapshot,
  operations: SearchAndReplaceWriteOperations
): Promise<void> {
  const mutationOperations = operations;
  await assertMarkdownMutationSnapshotCurrent(filePath, snapshot, mutationOperations);

  if (!operations.writeTextFile || operations.writeTextFile === atomicWriteTextFile) {
    await atomicWriteTextFile(filePath, content, undefined, {
      beforeRename: () => assertMarkdownMutationSnapshotCurrent(filePath, snapshot, mutationOperations)
    });
    return;
  }

  await operations.writeTextFile(filePath, content);
}

export async function searchAndReplace(
  workspacePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean,
  operations: SearchAndReplaceReadOperations = defaultSearchAndReplaceOperations
): Promise<RelicResult<SearchAndReplacePreviewResult>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    const matches: SearchAndReplaceMatch[] = [];
    let truncated = false;
    const targets = await readReplaceTargets(
      workspacePath,
      regex.value,
      isRegex,
      "置換プレビュー",
      operations
    );

    if (!targets.ok) return targets;

    const matchedFiles = new Map<string, SearchAndReplaceFileSnapshot>();

    for (const { content, relativePath } of targets.value.targets) {
      const lines = content.split("\n");
      let hasMatchInFile = false;

      for (const [index, line] of lines.entries()) {
        if (isRegex && !isRegexSafeLine(line)) continue;

        if (regex.value.test(line)) {
          hasMatchInFile = true;
          regex.value.lastIndex = 0;
          const newLineText = buildReplacementPreviewLine(line, regex.value, replacement, isRegex);
          if (matches.length < searchAndReplacePreviewMaxResults) {
            matches.push({
              lineNumber: index + 1,
              lineText: line.trim() === "" ? "(空行)" : line.trim(),
              newLineText: newLineText.trim() === "" ? "(空行)" : newLineText.trim(),
              path: relativePath
            });
          } else {
            truncated = true;
          }
        }

        regex.value.lastIndex = 0;
      }

      if (hasMatchInFile) {
        matchedFiles.set(relativePath, {
          contentHash: contentHash(content),
          path: relativePath
        });
      }
    }

    return ok({
      fileSnapshots: Array.from(matchedFiles.values()),
      matches,
      skippedUnreadableFiles: targets.value.skippedUnreadableFiles,
      truncated
    });
  } catch (error) {
    return fail(
      "REPLACE_FAILED",
      "置換プレビューを生成できませんでした。",
      errorDetails(error)
    );
  }
}

export async function applySearchAndReplace(
  workspacePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean,
  operations: SearchAndReplaceWriteOperations = defaultSearchAndReplaceOperations,
  expectedFileSnapshots?: SearchAndReplaceFileSnapshot[]
): Promise<RelicResult<ApplySearchAndReplaceResult>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    let count = 0;
    const writeTextFile = operations.writeTextFile ?? atomicWriteTextFile;
    const targets = await readReplaceTargets(
      workspacePath,
      regex.value,
      isRegex,
      "一括置換",
      operations
    );

    if (!targets.ok) return targets;

    const stalePreview = validateSearchAndReplacePreviewSnapshots(targets.value.targets, regex.value, expectedFileSnapshots);
    if (!stalePreview.ok) return stalePreview;

    const writtenPatches: Array<{
      absolutePath: string;
      previousContent: string;
      writtenContent: string;
    }> = [];

    try {
      for (const { absolutePath, content } of targets.value.targets) {
        const matches = content.match(regex.value);

        if (matches && matches.length > 0) {
          regex.value.lastIndex = 0;
          const updated = applyReplacement(content, regex.value, replacement, isRegex);
          await runMarkdownFileMutation(absolutePath, async () => {
            const snapshot = await captureMarkdownMutationSnapshot(absolutePath, operations);
            if (snapshot.content !== content) throw new Error("Replace target changed during write.");

            const safeWritePath = await verifyExistingWorkspacePath(workspacePath, absolutePath);
            if (!safeWritePath.ok) throw new Error(safeWritePath.error.code);

            await writeReplaceMutation(absolutePath, updated, snapshot, {
              ...operations,
              writeTextFile
            });
          });
          writtenPatches.push({ absolutePath, previousContent: content, writtenContent: updated });
          count += matches.length;
        }

        regex.value.lastIndex = 0;
      }
    } catch (error) {
      await Promise.all(
        writtenPatches.map((patch) => runMarkdownFileMutation(patch.absolutePath, async () => {
          try {
            const snapshot = await captureMarkdownMutationSnapshot(patch.absolutePath, operations);
            if (snapshot.content === patch.writtenContent) {
              const safeRollbackPath = await verifyExistingWorkspacePath(workspacePath, patch.absolutePath);
              if (!safeRollbackPath.ok) return;

              await writeReplaceMutation(patch.absolutePath, patch.previousContent, snapshot, {
                ...operations,
                writeTextFile
              });
            }
          } catch {
            // If another process changed or removed the file, avoid overwriting it during rollback.
          }
        }))
      );
      throw error;
    }

    return ok({ count, skippedUnreadableFiles: targets.value.skippedUnreadableFiles });
  } catch (error) {
    return fail(
      "REPLACE_FAILED",
      "一括置換できませんでした。",
      errorDetails(error)
    );
  }
}

async function readReplaceTargets(
  workspacePath: string,
  regex: RegExp,
  isRegex: boolean,
  regexTargetLabel: string,
  operations: SearchAndReplaceReadOperations
): Promise<RelicResult<SearchAndReplaceTargetsResult>> {
  const fileTree = await readWorkspaceFileTree(workspacePath);
  const relativePaths = collectMarkdownPaths(fileTree);
  if (relativePaths.length > maxReplaceTargetFiles) {
    return fail("REPLACE_FAILED", "置換対象のファイル数が上限を超えています。");
  }
  const files = await collectSafeMarkdownFiles(workspacePath, relativePaths);
  const boundedFiles: Array<{ absolutePath: string; relativePath: string; size: number }> = [];
  let aggregateBytes = 0;
  for (const file of files) {
    let fileStat;
    try {
      fileStat = await (operations.stat ?? stat)(file.absolutePath);
    } catch {
      return fail("REPLACE_FAILED", "置換対象のファイルサイズを確認できませんでした。");
    }
    if (!Number.isSafeInteger(fileStat.size) || fileStat.size < 0) {
      return fail("REPLACE_FAILED", "置換対象のファイルサイズを確認できませんでした。");
    }
    if (fileStat.size > maxReplaceReadBytes) {
      return fail("REPLACE_FAILED", "置換対象のファイルが大きすぎます。");
    }
    aggregateBytes += fileStat.size;
    if (aggregateBytes > maxReplaceAggregateReadBytes) {
      return fail("REPLACE_FAILED", "置換対象の合計サイズが大きすぎます。");
    }
    boundedFiles.push({ ...file, size: fileStat.size });
  }
  const fileContents = await mapWithConcurrency(
    boundedFiles,
    maxConcurrentReplaceReads,
    async (file) => {
      const { size: _size, ...targetFile } = file;
      if (file.size < 0) return { ...targetFile, unreadable: true };
      try {
        return { ...targetFile, content: await operations.readFile(file.absolutePath, "utf8") };
      } catch {
        return { ...targetFile, unreadable: true };
      }
    }
  );
  let actualAggregateBytes = 0;
  for (const fileContent of fileContents) {
    if (!("content" in fileContent)) continue;
    const contentBytes = Buffer.byteLength(fileContent.content, "utf8");
    if (contentBytes > maxReplaceReadBytes) {
      return fail("REPLACE_FAILED", "置換対象のファイルが大きすぎます。");
    }
    actualAggregateBytes += contentBytes;
    if (actualAggregateBytes > maxReplaceAggregateReadBytes) {
      return fail("REPLACE_FAILED", "置換対象の合計サイズが大きすぎます。");
    }
  }
  const targets = fileContents.filter((fileContent): fileContent is SearchAndReplaceTarget => "content" in fileContent);
  const skippedUnreadableFiles = fileContents
    .filter((fileContent): fileContent is { absolutePath: string; relativePath: string; unreadable: true } => "unreadable" in fileContent)
    .map((fileContent) => fileContent.relativePath);

  if (!isRegex) return ok({ skippedUnreadableFiles, targets });

  for (const { content } of targets) {
    const safeTarget = validateRegexTargetText(content, regexTargetLabel);
    if (!safeTarget.ok) return safeTarget;

    if (canMatchEmptyTextInContent(regex, content)) {
      return fail("REPLACE_REGEX_EMPTY_MATCH", "空文字に一致する正規表現は置換できません。");
    }
  }

  return ok({ skippedUnreadableFiles, targets });
}

async function collectSafeMarkdownFiles(
  workspacePath: string,
  relativePaths: string[]
): Promise<{ absolutePath: string; relativePath: string }[]> {
  const files = await mapWithConcurrency(
    relativePaths,
    maxConcurrentReplaceReads,
    async (relativePath) => {
      const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
      return absolutePath.ok ? { absolutePath: absolutePath.value, relativePath } : null;
    }
  );

  return files.filter((file): file is { absolutePath: string; relativePath: string } => file !== null);
}

function validateSearchAndReplacePreviewSnapshots(
  targets: SearchAndReplaceTarget[],
  regex: RegExp,
  expectedFileSnapshots: SearchAndReplaceFileSnapshot[] | undefined
): RelicResult<void> {
  if (!expectedFileSnapshots || expectedFileSnapshots.length === 0) return ok(undefined);

  const expectedByPath = new Map(expectedFileSnapshots.map((snapshot) => [snapshot.path, snapshot.contentHash]));

  for (const target of targets) {
    const matches = target.content.match(regex);
    regex.lastIndex = 0;
    if (!matches || matches.length === 0) continue;

    const expectedHash = expectedByPath.get(target.relativePath);
    if (!expectedHash || expectedHash !== contentHash(target.content)) {
      return fail("REPLACE_PREVIEW_STALE", "プレビュー後に対象ファイルが変更されています。再プレビューしてから一括置換してください。");
    }
  }

  return ok(undefined);
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
