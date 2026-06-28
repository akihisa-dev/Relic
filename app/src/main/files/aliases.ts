import type { Stats } from "node:fs";
import { readFile, stat } from "node:fs/promises";

import type { AliasIndex } from "../../shared/links";
import { fail, ok, type RelicResult } from "../../shared/result";
import { collectMarkdownPaths } from "../../shared/workspaceTree";
import { extractAliasesFromFrontmatterData } from "./aliasesModel";
import { errorDetails } from "./fileSystem";
import { readWorkspaceFileTree } from "./fileTree";
import { mapWithConcurrency } from "./concurrency";
import { parseFrontmatter } from "./frontmatter";
import { resolveWorkspaceRelativePath } from "./paths";
import {
  aliasesForRecord,
  createWorkspaceDerivedDataCache,
  normalizeWorkspaceDerivedDataOptions,
  readableWorkspaceMarkdownRecords,
  readWorkspaceDerivedFileIndex,
  type WorkspaceDerivedDataOptions,
  type WorkspaceMarkdownReadOperations
} from "./workspaceDerivedData";

interface AliasesReadOperations {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  stat?(filePath: string): Promise<Stats>;
}

const defaultAliasesReadOperations: AliasesReadOperations = {
  readFile,
  stat
};

const maxConcurrentAliasReads = 8;
const maxWorkspaceAliases = 5000;

interface AliasCacheRecord {
  aliases: string[];
  mtimeMs: number;
  size: number;
}

const aliasCacheByWorkspace = new Map<string, Map<string, AliasCacheRecord>>();

export async function readWorkspaceAliases(
  workspacePath: string,
  optionsOrOperations: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations = defaultAliasesReadOperations
): Promise<RelicResult<AliasIndex>> {
  if (isWorkspaceDerivedDataOptions(optionsOrOperations)) {
    return readWorkspaceAliasesFromIndex(workspacePath, optionsOrOperations);
  }

  return readWorkspaceAliasesFromFiles(workspacePath, optionsOrOperations);
}

async function readWorkspaceAliasesFromIndex(
  workspacePath: string,
  options: WorkspaceDerivedDataOptions
): Promise<RelicResult<AliasIndex>> {
  try {
    const normalizedOptions = normalizeWorkspaceDerivedDataOptions(options);
    const parseCache = normalizedOptions.parseCache ?? createWorkspaceDerivedDataCache();
    const fileIndex = await readWorkspaceDerivedFileIndex(workspacePath, normalizedOptions);
    const aliases: AliasIndex = {};
    let remainingWorkspaceAliases = maxWorkspaceAliases;

    for (const record of readableWorkspaceMarkdownRecords(fileIndex)) {
      const fileAliases = aliasesForRecord(record, parseCache).slice(0, remainingWorkspaceAliases);
      remainingWorkspaceAliases -= fileAliases.length;

      if (fileAliases.length > 0) {
        aliases[record.path] = fileAliases;
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

async function readWorkspaceAliasesFromFiles(
  workspacePath: string,
  operations: AliasesReadOperations
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

function isWorkspaceDerivedDataOptions(
  value: WorkspaceDerivedDataOptions | WorkspaceMarkdownReadOperations
): value is WorkspaceDerivedDataOptions {
  return "operations" in value ||
    "fileIndex" in value ||
    "fileTree" in value ||
    "filePaths" in value ||
    "cachePath" in value ||
    "parseCache" in value;
}

export function extractAliases(markdown: string): string[] {
  return extractAliasesFromFrontmatterData(parseFrontmatter(markdown).data);
}
