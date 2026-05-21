import { readFile } from "node:fs/promises";

import type { AliasIndex } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownCardPaths } from "../../shared/cardbookTree";
import { readCardbookCardTree } from "./cardTree";
import { parseFrontmatter } from "./frontmatter";
import { resolveCardbookRelativePath } from "./paths";

export async function readCardbookAliases(cardbookPath: string): Promise<RelicResult<AliasIndex>> {
  try {
    const cardTree = await readCardbookCardTree(cardbookPath);
    const aliases: AliasIndex = {};

    for (const relativePath of collectMarkdownCardPaths(cardTree)) {
      const absolutePath = resolveCardbookRelativePath(cardbookPath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const cardAliases = extractAliases(content);

      if (cardAliases.length > 0) {
        aliases[relativePath] = cardAliases;
      }
    }

    return ok(aliases);
  } catch (error) {
    return fail(
      "ALIASES_READ_FAILED",
      "別名を読み込めませんでした。",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function extractAliases(markdown: string): string[] {
  const { data } = parseFrontmatter(markdown);
  const value = data.aliases;

  if (Array.isArray(value)) {
    return uniqueAliases(value.map(String));
  }

  if (typeof value === "string") {
    return uniqueAliases([value]);
  }

  return [];
}

function uniqueAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const alias = value.trim();
    const key = alias.toLocaleLowerCase();
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }

  return result;
}
