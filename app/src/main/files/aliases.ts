import type { Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";

import type { AliasIndex } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { mapWithConcurrency } from "./concurrency";
import { parseFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";

interface AliasesReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat?(filePath: string): Promise<Pick<Stats, "mtimeMs" | "size">>;
}

const defaultAliasesReadOperations: AliasesReadOperations = {
  readFile,
  stat
};

const maxConcurrentAliasReads = 8;
const maxAliasLength = 256;
const maxAliasesPerFile = 64;
const maxWorkspaceAliases = 5000;

interface AliasCacheRecord {
  aliases: string[];
  mtimeMs: number;
  size: number;
}

const aliasCacheByWorkspace = new Map<string, Map<string, AliasCacheRecord>>();

export async function readWorkspaceAliases(
  workspacePath: string,
  operations: AliasesReadOperations = defaultAliasesReadOperations
): Promise<RelicResult<AliasIndex>> {
  try {
    const fileTree = await readWorkspaceFileTree(workspacePath);
    const aliases: AliasIndex = {};
    const workspaceCache = aliasCacheByWorkspace.get(workspacePath) ?? new Map<string, AliasCacheRecord>();
    const nextCache = new Map<string, AliasCacheRecord>();
    let remainingWorkspaceAliases = maxWorkspaceAliases;
    const files = collectMarkdownPaths(fileTree).flatMap((relativePath) => {
      const absolutePath = resolveWorkspaceRelativePath(workspacePath, relativePath);
      return absolutePath.ok ? [{ absolutePath: absolutePath.value, relativePath }] : [];
    });
    const fileContents = await mapWithConcurrency(
      files,
      maxConcurrentAliasReads,
      async (file) => {
        try {
          const fileStats = await (operations.stat ?? stat)(file.absolutePath);
          const cached = workspaceCache.get(file.relativePath);

          if (
            cached &&
            cached.mtimeMs === fileStats.mtimeMs &&
            cached.size === fileStats.size
          ) {
            return { ...file, aliases: cached.aliases, mtimeMs: fileStats.mtimeMs, size: fileStats.size };
          }

          const content = await operations.readFile(file.absolutePath, "utf8");
          return {
            ...file,
            aliases: extractAliases(content),
            mtimeMs: fileStats.mtimeMs,
            size: fileStats.size
          };
        } catch {
          return null;
        }
      }
    );

    for (const fileContent of fileContents) {
      if (!fileContent) continue;

      const { relativePath } = fileContent;
      const fileAliases = fileContent.aliases.slice(0, remainingWorkspaceAliases);
      remainingWorkspaceAliases -= fileAliases.length;
      nextCache.set(relativePath, {
        aliases: fileContent.aliases,
        mtimeMs: fileContent.mtimeMs,
        size: fileContent.size
      });

      if (fileAliases.length > 0) {
        aliases[relativePath] = fileAliases;
      }
    }

    aliasCacheByWorkspace.set(workspacePath, nextCache);

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
    return uniqueAliases(value);
  }

  if (typeof value === "string") {
    return uniqueAliases([value]);
  }

  return [];
}

function uniqueAliases(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (result.length >= maxAliasesPerFile) break;
    if (typeof value !== "string") continue;

    const alias = value.trim();
    const key = alias.toLocaleLowerCase();
    if (!alias || alias.length > maxAliasLength || seen.has(key)) continue;
    seen.add(key);
    result.push(alias);
  }

  return result;
}
