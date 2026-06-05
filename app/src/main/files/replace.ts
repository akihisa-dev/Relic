import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  ReplaceInFileResult,
  SearchAndReplaceMatch
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { atomicWriteTextFile } from "./atomicWrite";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveExistingWorkspacePath } from "./paths";
import { applyReplacement, buildReplacementPreviewLine, buildReplacementRegex } from "./replaceModel";

interface SearchAndReplaceReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultSearchAndReplaceReadOperations: SearchAndReplaceReadOperations = {
  readFile
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

  if (path.extname(relativePath) !== ".md") {
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
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function searchAndReplace(
  workspacePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean,
  operations: SearchAndReplaceReadOperations = defaultSearchAndReplaceReadOperations
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
      const lines = content.split("\n");

      for (const [index, line] of lines.entries()) {

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
      error instanceof Error ? error.message : String(error)
    );
  }
}

export async function applySearchAndReplace(
  workspacePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean
): Promise<RelicResult<{ count: number }>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    let count = 0;
    const files = await collectSafeMarkdownFiles(workspacePath, collectMarkdownPaths(fileTree));
    const fileContents = await Promise.all(
      files.map(async (file) => ({ ...file, content: await readFile(file.absolutePath, "utf8") }))
    );

    for (const { absolutePath, content } of fileContents) {
      const matches = content.match(regex.value);

      if (matches && matches.length > 0) {
        regex.value.lastIndex = 0;
        const updated = applyReplacement(content, regex.value, replacement, isRegex);
        await atomicWriteTextFile(absolutePath, updated);
        count += matches.length;
      }

      regex.value.lastIndex = 0;
    }

    return ok({ count });
  } catch (error) {
    return fail(
      "REPLACE_FAILED",
      "一括置換できませんでした。",
      error instanceof Error ? error.message : String(error)
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
