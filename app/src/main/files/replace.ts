import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type {
  ApplySearchAndReplaceResult,
  ReplaceInFileResult,
  SearchAndReplaceFileSnapshot,
  SearchAndReplaceMatch,
  SearchAndReplacePreviewResult
} from "../../shared/ipc";
import { hasMarkdownExtension } from "../../shared/markdownExtension";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { atomicWriteTextFile } from "./atomicWrite";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath } from "./paths";
import { applyReplacement, buildReplacementPreviewLine, buildReplacementRegex, canMatchEmptyTextInContent } from "./replaceModel";
import { isRegexSafeLine, validateRegexTargetText } from "./regexSafety";

interface SearchAndReplaceReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

interface SearchAndReplaceWriteOperations extends SearchAndReplaceReadOperations {
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

const defaultSearchAndReplaceOperations: Required<SearchAndReplaceWriteOperations> = {
  readFile,
  writeTextFile: atomicWriteTextFile
};

export async function replaceInFile(
  workspacePath: string,
  relativePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean
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
    const content = await readFile(absolutePath.value, "utf8");
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
      await atomicWriteTextFile(absolutePath.value, updated);
    }

    return ok({ count });
  } catch (error) {
    return fail(
      "REPLACE_FAILED",
      "置換できませんでした。",
      errorDetails(error)
    );
  }
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
          matches.push({
            lineNumber: index + 1,
            lineText: line.trim() === "" ? "(空行)" : line.trim(),
            newLineText: newLineText.trim() === "" ? "(空行)" : newLineText.trim(),
            path: relativePath
          });
          if (matches.length >= searchAndReplacePreviewMaxResults) {
            truncated = true;
            break;
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

      if (truncated) break;
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
    const writeTextFile = operations.writeTextFile ?? defaultSearchAndReplaceOperations.writeTextFile;
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
          await writeTextFile(absolutePath, updated);
          writtenPatches.push({ absolutePath, previousContent: content, writtenContent: updated });
          count += matches.length;
        }

        regex.value.lastIndex = 0;
      }
    } catch (error) {
      await Promise.all(
        writtenPatches.map(async (patch) => {
          try {
            const currentContent = await operations.readFile(patch.absolutePath, "utf8");
            if (currentContent === patch.writtenContent) {
              await writeTextFile(patch.absolutePath, patch.previousContent);
            }
          } catch {
            // If another process changed or removed the file, avoid overwriting it during rollback.
          }
        })
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
  const files = await collectSafeMarkdownFiles(workspacePath, collectMarkdownPaths(fileTree));
  const fileContents = await Promise.all(
    files.map(async (file) => {
      try {
        return { ...file, content: await operations.readFile(file.absolutePath, "utf8") };
      } catch {
        return { ...file, unreadable: true };
      }
    })
  );
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
  const files = await Promise.all(
    relativePaths.map(async (relativePath) => {
      const absolutePath = await resolveExistingWorkspacePath(workspacePath, relativePath);
      return absolutePath.ok ? { absolutePath: absolutePath.value, relativePath } : null;
    })
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
