import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  SearchMode,
  CardbookSearchResult
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { parseMarkdownTags } from "../../shared/tags";
import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import { extractAliases } from "./aliases";
import { parseFrontmatter } from "./frontmatter";
import { readCardbookCardTree } from "./cardTree";
import { resolveCardbookRelativePath } from "./paths";

export async function searchCardbook(
  cardbookPath: string,
  query: string,
  mode: SearchMode,
  frontmatterField?: string
): Promise<RelicResult<CardbookSearchResult[]>> {
  const normalizedQuery = query.trim();
  const normalizedFrontmatterField = frontmatterField?.trim() ?? "";

  if (normalizedQuery === "") {
    return ok([]);
  }

  if (mode === "frontmatter" && normalizedFrontmatterField === "") {
    return ok([]);
  }

  let regex: RegExp | null = null;

  if (mode === "regex") {
    try {
      regex = new RegExp(normalizedQuery, "i");
    } catch {
      return fail("SEARCH_REGEX_INVALID", "正規表現が正しくありません。");
    }
  }

  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    const results: CardbookSearchResult[] = [];

    for (const relativePath of collectMarkdownCardPaths(cardTree)) {
      const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

      if (!absolutePath.ok) continue;

      const cardName = path.basename(relativePath, ".md");
      const content = await readFile(absolutePath.value, "utf8");

      if (mode === "cardName") {
        const alias = extractAliases(content).find((item) =>
          item.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase())
        );

        if (cardName.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase()) || alias) {
          results.push({ cardName, lineNumber: null, lineText: alias ? `alias: ${alias}` : relativePath, path: relativePath });
        }

        continue;
      }

      if (mode === "tag") {
        const tagQuery = normalizedQuery.replace(/^#/, "");

        if (parseMarkdownTags(content).tags.includes(tagQuery)) {
          results.push({ cardName, lineNumber: null, lineText: `tags: ${tagQuery}`, path: relativePath });
        }

        continue;
      }

      if (mode === "frontmatter") {
        const { data } = parseFrontmatter(content);
        const fieldValue = data[normalizedFrontmatterField];

        if (matchesFrontmatterField(fieldValue, normalizedQuery)) {
          results.push({
            cardName,
            lineNumber: null,
            lineText: `${normalizedFrontmatterField}: ${formatFrontmatterValue(fieldValue)}`,
            path: relativePath
          });
        }

        continue;
      }

      const lines = content.split("\n");

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const matches =
          mode === "regex"
            ? regex!.test(line)
            : line.toLocaleLowerCase().includes(normalizedQuery.toLocaleLowerCase());

        if (matches) {
          results.push({
            cardName,
            lineNumber: index + 1,
            lineText: line.trim() === "" ? "(空行)" : line.trim(),
            path: relativePath
          });
        }
      }
    }

    return ok(results);
  } catch (error) {
    return fail(
      "SEARCH_FAILED",
      "検索できませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function matchesFrontmatterField(value: unknown, query: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => String(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  }

  if (typeof value === "boolean") {
    const normalizedQuery = query.toLocaleLowerCase();

    if (["true", "1", "yes", "on"].includes(normalizedQuery)) {
      return value === true;
    }

    if (["false", "0", "no", "off"].includes(normalizedQuery)) {
      return value === false;
    }

    return String(value).toLocaleLowerCase() === normalizedQuery;
  }

  return String(value).toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function formatFrontmatterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return String(value);
}
