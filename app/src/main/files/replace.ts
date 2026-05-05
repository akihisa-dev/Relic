import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ReplaceInFileResult,
  SearchAndReplaceMatch,
  WorkspaceTreeNode
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { readWorkspaceFileTree } from "./fileTree";
import { resolveWorkspaceRelativePath } from "./paths";

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

  const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

  if (!absolutePath.ok) {
    return absolutePath;
  }

  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownファイルだけを対象にできます。");
  }

  let regex: RegExp;

  try {
    regex = isRegex
      ? new RegExp(searchQuery, "g")
      : new RegExp(escapeRegExp(searchQuery), "g");
  } catch {
    return fail("REPLACE_REGEX_INVALID", "正規表現が正しくありません。");
  }

  try {
    const content = await readFile(absolutePath.value, "utf8");
    const matches = content.match(regex);
    const count = matches ? matches.length : 0;

    if (count > 0) {
      const updated = content.replaceAll(regex, replacement);
      await writeFile(absolutePath.value, updated, "utf8");
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
  isRegex: boolean
): Promise<RelicResult<SearchAndReplaceMatch[]>> {
  if (searchQuery.trim() === "") {
    return fail("REPLACE_EMPTY_QUERY", "検索語句を入力してください。");
  }

  let regex: RegExp;

  try {
    regex = isRegex
      ? new RegExp(searchQuery, "g")
      : new RegExp(escapeRegExp(searchQuery), "g");
  } catch {
    return fail("REPLACE_REGEX_INVALID", "正規表現が正しくありません。");
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const matches: SearchAndReplaceMatch[] = [];

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const lines = content.split("\n");

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (regex.test(line)) {
          regex.lastIndex = 0;
          const newLineText = line.replaceAll(regex, replacement);
          matches.push({
            lineNumber: index + 1,
            lineText: line.trim() === "" ? "(空行)" : line.trim(),
            newLineText: newLineText.trim() === "" ? "(空行)" : newLineText.trim(),
            path: relativePath
          });
        }

        regex.lastIndex = 0;
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
  if (searchQuery.trim() === "") {
    return fail("REPLACE_EMPTY_QUERY", "検索語句を入力してください。");
  }

  let regex: RegExp;

  try {
    regex = isRegex
      ? new RegExp(searchQuery, "g")
      : new RegExp(escapeRegExp(searchQuery), "g");
  } catch {
    return fail("REPLACE_REGEX_INVALID", "正規表現が正しくありません。");
  }

  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    let count = 0;

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        regex.lastIndex = 0;
        const updated = content.replaceAll(regex, replacement);
        await writeFile(absolutePath.value, updated, "utf8");
        count += matches.length;
      }

      regex.lastIndex = 0;
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

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
