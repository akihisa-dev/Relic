import { readFile } from "node:fs/promises";

import type { AliasIndex } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { readWorkspaceFileTree } from "./fileTree";
import { parseFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";

export async function readWorkspaceAliases(workspacePath: string): Promise<RelicResult<AliasIndex>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const aliases: AliasIndex = {};

    for (const relativePath of collectMarkdownPaths(fileTree)) {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);

      if (!absolutePath.ok) continue;

      const content = await readFile(absolutePath.value, "utf8");
      const fileAliases = extractAliases(content);

      if (fileAliases.length > 0) {
        aliases[relativePath] = fileAliases;
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
