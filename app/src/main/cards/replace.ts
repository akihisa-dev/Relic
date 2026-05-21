import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  ReplaceInCardResult,
  SearchAndReplaceMatch
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import { readCardbookCardTree } from "./cardTree";
import { resolveCardbookRelativePath } from "./paths";
import { buildReplacementPreviewLine, buildReplacementRegex } from "./replaceModel";

export async function replaceInCard(
  cardbookPath: string,
  relativePath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean
): Promise<RelicResult<ReplaceInCardResult>> {
  if (searchQuery.trim() === "") {
    return fail("REPLACE_EMPTY_QUERY", "検索語句を入力してください。");
  }

  const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

  if (!absolutePath.ok) {
    return absolutePath;
  }

  if (path.extname(relativePath) !== ".md") {
    return fail("FILE_TYPE_UNSUPPORTED", "Markdownカードだけを対象にできます。");
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
      const updated = content.replaceAll(regex.value, replacement);
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
  cardbookPath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean
): Promise<RelicResult<SearchAndReplaceMatch[]>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    const matches: SearchAndReplaceMatch[] = [];

    for (const relativePath of collectMarkdownCardPaths(cardTree)) {
      const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const lines = content.split("\n");

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (regex.value.test(line)) {
          regex.value.lastIndex = 0;
          const newLineText = buildReplacementPreviewLine(line, regex.value, replacement);
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
  cardbookPath: string,
  searchQuery: string,
  replacement: string,
  isRegex: boolean
): Promise<RelicResult<{ count: number }>> {
  const regex = buildReplacementRegex(searchQuery, isRegex);

  if (!regex.ok) {
    return regex;
  }

  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    let count = 0;

    for (const relativePath of collectMarkdownCardPaths(cardTree)) {
      const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const matches = content.match(regex.value);

      if (matches && matches.length > 0) {
        regex.value.lastIndex = 0;
        const updated = content.replaceAll(regex.value, replacement);
        await writeFile(absolutePath.value, updated, "utf8");
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
