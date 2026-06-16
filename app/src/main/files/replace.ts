import { readFile } from "node:fs/promises";

import type {
  ReplaceInFileResult,
  SearchAndReplaceMatch
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
): Promise<RelicResult<SearchAndReplaceMatch[]>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const matches: SearchAndReplaceMatch[] = [];
    const files = await collectSafeMarkdownFiles(workspacePath, collectMarkdownPaths(fileTree));
    const fileContents = await Promise.all(
      files.map(async (file) => {
        try {
          return { ...file, content: await operations.readFile(file.absolutePath, "utf8") };
        } catch {
          return null;
        }
      })
    );

    for (const fileContent of fileContents) {
      if (!fileContent) continue;

      const { content, relativePath } = fileContent;
      if (isRegex) {
        const safeTarget = validateRegexTargetText(content, "置換プレビュー");
        if (!safeTarget.ok) return safeTarget;
      }

      if (isRegex && canMatchEmptyTextInContent(regex.value, content)) {
        return fail("REPLACE_REGEX_EMPTY_MATCH", "空文字に一致する正規表現は置換できません。");
      }

      const lines = content.split("\n");

      for (const [index, line] of lines.entries()) {
        if (isRegex && !isRegexSafeLine(line)) continue;

        if (regex.value.test(line)) {
          regex.value.lastIndex = 0;
          const newLineText = buildReplacementPreviewLine(line, regex.value, replacement, isRegex);
          matches.push({
            lineNumber: index + 1,
            lineText: line.trim() === "" ? "(空行)" : line.trim(),
            newLineText: newLineText.trim() === "" ? "(空行)" : newLineText.trim(),
            path: relativePath
          });
        }

        regex.value.lastIndex = 0;
      }
    }

    return ok(matches);
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
  operations: SearchAndReplaceWriteOperations = defaultSearchAndReplaceOperations
): Promise<RelicResult<{ count: number }>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    let count = 0;
    const writeTextFile = operations.writeTextFile ?? defaultSearchAndReplaceOperations.writeTextFile;
    const files = await collectSafeMarkdownFiles(workspacePath, collectMarkdownPaths(fileTree));
    const fileContents = await Promise.all(
      files.map(async (file) => {
        try {
          return { ...file, content: await operations.readFile(file.absolutePath, "utf8") };
        } catch {
          return null;
        }
      })
    );

    for (const fileContent of fileContents) {
      if (!fileContent) continue;
      if (isRegex) {
        const safeTarget = validateRegexTargetText(fileContent.content, "一括置換");
        if (!safeTarget.ok) return safeTarget;
      }

      if (isRegex && canMatchEmptyTextInContent(regex.value, fileContent.content)) {
        return fail("REPLACE_REGEX_EMPTY_MATCH", "空文字に一致する正規表現は置換できません。");
      }
    }

    const writtenPatches: Array<{
      absolutePath: string;
      previousContent: string;
      writtenContent: string;
    }> = [];

    try {
      for (const fileContent of fileContents) {
        if (!fileContent) continue;

        const { absolutePath, content } = fileContent;
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

    return ok({ count });
  } catch (error) {
    return fail(
      "REPLACE_FAILED",
      "一括置換できませんでした。",
      errorDetails(error)
    );
  }
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
