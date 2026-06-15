import { readFile } from "node:fs/promises";

import type { AliasIndex } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { parseFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";

interface AliasesReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
}

const defaultAliasesReadOperations: AliasesReadOperations = {
  readFile
};

export async function readWorkspaceAliases(
  workspacePath: string,
  operations: AliasesReadOperations = defaultAliasesReadOperations
): Promise<RelicResult<AliasIndex>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const aliases: AliasIndex = {};
    const files = collectMarkdownPaths(fileTree).flatMap((relativePath) => {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);
      return absolutePath.ok ? [{ absolutePath: absolutePath.value, relativePath }] : [];
    });
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
      errorDetails(error)
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
